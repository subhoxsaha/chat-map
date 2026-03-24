"use client";

import { useEffect, useRef, useState } from "react";
import { 
  Box, Typography, Avatar as MUIAvatar, TextField, IconButton, 
  Badge, useTheme, Button, Dialog, DialogTitle, DialogContent, 
  DialogContentText, DialogActions
} from "@mui/material";
import { 
  Send as SendIcon, 
  Close as CloseIcon, 
  AddCircleOutline as AttachIcon,
  DeleteOutline as DeleteOutlineIcon,
  ArrowBack as ArrowBackIcon,
  Language as GlobeIcon,
  DeleteForever as DeleteForeverIcon,
  DeleteSweep as ClearIcon
} from "@mui/icons-material";

function formatTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" }); }
  catch { return ""; }
}

function dicebearUrl(seed) {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

function Avatar({ name, image, size=32 }) {
  // DB-only identity: image is now always the DB PFP or a DiceBear URL
  // Handle special "globe" case for the global chat room
  if (image === "__globe__") {
    return (
      <MUIAvatar sx={{ width: size, height: size, bgcolor: 'primary.main', border: '1px solid', borderColor: 'divider' }}>
        <GlobeIcon sx={{ color: '#fff', fontSize: size * 0.6 }} />
      </MUIAvatar>
    );
  }

  return (
    <MUIAvatar src={image || dicebearUrl(name || "default")} alt={name || "?"} sx={{ width: size, height: size, border: '1px solid', borderColor: 'divider' }}>
      {(name||"?").charAt(0).toUpperCase()}
    </MUIAvatar>
  );
}

export default function ChatPanel({
  users=[], messages=[], typingUsers={}, activeRoom=null,
  onRoomChange, onSendMessage, onTyping, deleteMessage, sessionUser, dmRooms=[], onClose,
  lastRead={}, onLeaveChat, onClearChat, onMarkRead,
}) {
  const scrollRef = useRef(null);
  const bottomRef = useRef(null);
  const [inputText, setInputText] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const timerRef = useRef(null);
  const activeChatRef = useRef(null);
  const theme = useTheme();

  // Trigger markRead on room change or new messages while focused
  useEffect(() => {
    if (activeRoom && onMarkRead) {
      onMarkRead(activeRoom);
    }
  }, [activeRoom, messages.length, onMarkRead]);

  const isAtBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop <= el.clientHeight + 100;
  };

  useEffect(() => {
    if (activeRoom !== null) {
      if (isAtBottom()) {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setShowScrollBtn(true);
      }
    }
  }, [messages, activeRoom]);

  const handleScroll = () => {
    if (isAtBottom()) setShowScrollBtn(false);
  };

  const jumpToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const handleSend = e => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeRoom) return;
    onSendMessage(text, activeRoom);
    setInputText("");
    onTyping?.(activeRoom, false);
  };

  const handleChange = e => {
    setInputText(e.target.value);
    if (!onTyping || !activeRoom) return;
    clearTimeout(timerRef.current);
    if (e.target.value.trim()) {
      onTyping(activeRoom, true);
      timerRef.current = setTimeout(() => onTyping(activeRoom, false), 2000);
    } else {
      onTyping(activeRoom, false);
    }
  };

  const getRoomLabel = (roomId) => {
    if (roomId === "global") return { label:"Global", short:"Global", image: "__globe__" };
    
    const dm = dmRooms.find(r => r.roomId === roomId);
    if (!dm) return { label: roomId, short: "DM", image: null };

    // SINGLE SOURCE OF TRUTH: If user is online, use their LIVE profile
    const liveUser = users.find(u => u.id === dm.withUserId);
    const label = liveUser?.displayName || liveUser?.name || dm.withName;
    const image = liveUser?.customAvatar || dm.withImage;

    return { 
      label, 
      short: label?.split(" ")[0] || "DM", 
      image 
    };
  };

  const allRooms = ["global", ...dmRooms.map(r => r.roomId)];

  // ── MASTER LIST VIEW ──
  if (activeRoom === null) {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: "background.paper" }}>
        {/* Header */}
        <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight="800" letterSpacing="-0.5px">Recent Chats</Typography>
          {onClose && (
            <IconButton size="small" onClick={onClose} sx={{ bgcolor: 'action.hover' }}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* List */}
        <Box sx={{ flex: 1, overflowY: "auto", display: 'flex', flexDirection: 'column' }}>
          {allRooms.map(roomId => {
            const { short, label, image } = getRoomLabel(roomId);
            const rMsgs = messages.filter(m => m.roomId === roomId);
            const lastMsg = rMsgs[rMsgs.length - 1];
            const rLastRead = lastRead[roomId] || 0;
            const unreadCount = rMsgs.filter(m => new Date(m.timestamp || m.createdAt).getTime() > rLastRead).length;

            return (
              <Box 
                key={roomId} 
                onClick={() => onRoomChange?.(roomId)}
                sx={{ 
                  display: "flex", alignItems: "center", p: 2, gap: 2,
                  borderBottom: "1px solid", borderColor: "divider",
                  cursor: "pointer", transition: "all 0.2s",
                  "&:hover": { bgcolor: "action.hover", pl: 2.5 }
                }}
              >
                {/* Avatar with Badge */}
                <Badge color="error" badgeContent={unreadCount} invisible={unreadCount === 0} sx={{ '& .MuiBadge-badge': { top: 4, right: 4, border: '2px solid', borderColor: 'background.paper' } }}>
                  <Avatar name={short} image={image} size={48} />
                </Badge>
                
                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.3 }}>
                    <Typography variant="subtitle1" fontWeight={unreadCount > 0 ? 800 : 600} noWrap sx={{ color: 'text.primary', lineHeight: 1.2 }}>
                      {label}
                    </Typography>
                    {lastMsg && (
                      <Typography variant="caption" color={unreadCount > 0 ? "primary.main" : "text.secondary"} fontWeight={unreadCount > 0 ? 700 : 500} sx={{ flexShrink: 0, ml: 1 }}>
                        {formatTime(lastMsg.timestamp || lastMsg.createdAt)}
                      </Typography>
                    )}
                  </Box>
                  
                  {lastMsg ? (
                    <Typography 
                      variant="body2" 
                      color={unreadCount > 0 ? "text.primary" : "text.secondary"} 
                      fontWeight={unreadCount > 0 ? 600 : 400} 
                      noWrap 
                      sx={{ opacity: unreadCount > 0 ? 1 : 0.8 }}
                    >
                      {lastMsg.senderId === sessionUser?.id ? "You: " : `${lastMsg.senderName.split(" ")[0]}: `}
                      {lastMsg.text}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.disabled" sx={{ fontStyle: "italic" }}>
                      Tap to start chatting
                    </Typography>
                  )}
                </Box>

                {/* End of item */}
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  // ── DETAIL VIEW (Active Chat) ──


  const roomMsgs = messages.filter(m => m.roomId === activeRoom);
  const typists  = Object.entries(typingUsers[activeRoom] || {})
    .filter(([n,t]) => t && n !== sessionUser?.name).map(([n]) => n);
  const { label, short, image } = getRoomLabel(activeRoom);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: "background.paper" }}>
      
      {/* ── Detail Header ── */}
      <Box sx={{ 
        display: "flex", alignItems: "center", p: 1.5, px: 2,
        borderBottom: 1, borderColor: "divider", bgcolor: "rgba(0,0,0,0.02)"
      }}>
        <IconButton size="small" onClick={() => onRoomChange?.(null)} sx={{ mr: 1.5, bgcolor: "background.paper", boxShadow: '0 2px 5px rgba(0,0,0,0.08)' }}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Avatar name={label} image={image} size={40} />
        <Box sx={{ ml: 2, flex: 1, minWidth: 0 }}>
          <Typography variant="h6" fontWeight="800" noWrap sx={{ color: 'text.primary', lineHeight: 1.2 }}>{label}</Typography>
          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600 }}>
            {activeRoom === "global" ? `${users.length} Active` : "Online"}
          </Typography>
        </Box>

        {/* Clear Chat Button */}
        {onClearChat && (
          <IconButton 
            size="small" 
            onClick={() => setConfirmOpen(true)}
            sx={{ color: "text.secondary", '&:hover': { color: 'error.main', bgcolor: 'rgba(211,47,47,0.08)' } }}
            title="Clear Chat"
          >
            <ClearIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* ── Messages ── */}
      <Box sx={{ flex: 1, position: "relative", minHeight: 0 }}>
        <Box 
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{ 
            height: "100%", overflowY: "auto", px: 2, py: 2, display: "flex", flexDirection: "column",
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-track': { background: 'transparent' },
            '&::-webkit-scrollbar-thumb': { 
              background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderRadius: 10,
              '&:hover': { background: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' }
            }
          }}
        >
        {roomMsgs.length === 0 ? (
          <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", opacity: 0.5 }}>
            <Typography variant="h3" mb={1}>💬</Typography>
            <Typography variant="body2" color="text.secondary">Say hello in {label}</Typography>
          </Box>
        ) : (
          roomMsgs.map((msg, i) => {
            const isSelf = msg.senderId === sessionUser?.id;
            const prev = roomMsgs[i-1];
            const grouped = prev?.senderId === msg.senderId;
            
            // Resolve avatar dynamically: live data wins over stale stored values.
            // This handles historical messages that have old/Google images baked in.
            const liveUser = users.find(u => u.id === msg.senderId);
            const imgSrc = isSelf
              ? (sessionUser?.customAvatar || dicebearUrl(sessionUser?.id || "self"))
              : (liveUser?.customAvatar || msg.senderCustomAvatar || msg.senderImage || dicebearUrl(msg.senderId || msg.senderName));

            const currentMsgDate = new Date(msg.timestamp || msg.createdAt).toDateString();
            const prevMsgDate = prev ? new Date(prev.timestamp || prev.createdAt).toDateString() : null;
            const showDate = currentMsgDate !== prevMsgDate;

            return (
              <Box key={msg.id || `${msg.timestamp}-${i}`} sx={{ display: 'flex', flexDirection: 'column' }}>
                {showDate && (
                  <Box sx={{ display: 'flex', justifyContent: 'center', my: 2, position: 'relative' }}>
                    <Typography variant="caption" sx={{ 
                      bgcolor: 'action.hover', px: 1.5, py: 0.5, borderRadius: 2, 
                      fontSize: '0.65rem', fontWeight: 700, color: 'text.secondary',
                      zIndex: 1, textTransform: 'uppercase', letterSpacing: '0.5px'
                    }}>
                      {currentMsgDate === new Date().toDateString() ? 'Today' : 
                       currentMsgDate === new Date(Date.now() - 86400000).toDateString() ? 'Yesterday' : 
                       currentMsgDate}
                    </Typography>
                    <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', bgcolor: 'divider', zIndex: 0 }} />
                  </Box>
                )}
                
                <Box sx={{ 
                  display: 'flex', alignItems: 'flex-end', gap: 1, 
                  mt: grouped && !showDate ? 0.3 : 1.5, 
                  flexDirection: isSelf ? 'row-reverse' : 'row' 
                }}>
                  {!isSelf && (
                    <Box sx={{ opacity: grouped ? 0 : 1, width: 28, height: 28, flexShrink: 0 }}>
                      <Avatar name={msg.senderName} image={imgSrc} size={28}/>
                    </Box>
                  )}
                  <Box sx={{ 
                    display: 'flex', flexDirection: 'column', 
                    alignItems: isSelf ? 'flex-end' : 'flex-start', 
                    maxWidth: '82%',
                    '&:hover .delete-btn': { opacity: 0.6 },
                    '& .delete-btn:hover': { opacity: 1 }
                  }}>
                    {!isSelf && !grouped && (
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mb: 0.2, fontWeight: 600, fontSize: '0.7rem' }}>
                        {msg.senderName}
                      </Typography>
                    )}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexDirection: isSelf ? 'row-reverse' : 'row' }}>
                      <Box sx={{ 
                        px: 1.75, py: 1, borderRadius: 3, wordBreak: 'break-word',
                        bgcolor: isSelf ? 'primary.main' : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                        color: isSelf ? '#fff' : 'text.primary',
                        borderBottomRightRadius: isSelf && !grouped ? 4 : 20,
                        borderBottomLeftRadius: !isSelf && !grouped ? 4 : 20,
                        borderTopRightRadius: isSelf && grouped ? 4 : 20,
                        borderTopLeftRadius: !isSelf && grouped ? 4 : 20,
                        boxShadow: isSelf ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                      }}>
                        <Typography variant="body2" sx={{ lineHeight: 1.45, fontSize: '0.875rem' }}>
                          {msg.text}
                        </Typography>
                      </Box>

                      {isSelf && (
                        <IconButton 
                          size="small" 
                          onClick={() => deleteMessage(msg.id, activeRoom)}
                          sx={{ 
                            opacity: 0, 
                            transition: 'opacity 0.2s', 
                            color: 'error.main',
                            p: 0.5,
                            '&:hover': { bgcolor: 'error.lighter' }
                          }}
                          className="delete-btn"
                        >
                          <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
                        </IconButton>
                      )}
                    </Box>
                    {!grouped && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, mx: 1, fontSize: "0.62rem", opacity: 0.7 }}>
                        {formatTime(msg.timestamp || msg.createdAt)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Box>
            );
          })
        )}
          <div ref={bottomRef}/>
        </Box>

        {/* Scroll FAB */}
        {showScrollBtn && (
          <Button
            size="small"
            variant="contained"
            onClick={jumpToBottom}
            startIcon={<CloseIcon sx={{ transform: 'rotate(45deg)', fontSize: '0.8rem' }} />}
            sx={{
              position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
              borderRadius: 50, textTransform: 'none', px: 2.3, py: 0.8,
              bgcolor: 'background.paper', color: 'primary.main', border: '1px solid', borderColor: 'divider',
              fontSize: '0.75rem', fontWeight: 700,
              '&:hover': { bgcolor: 'background.default' },
              zIndex: 10, boxShadow: theme.shadows[8]
            }}
          >
            New Messages
          </Button>
        )}
      </Box>

      {/* ── Typing ── */}
      <Box sx={{ px: 2, height: 18, flexShrink: 0, mb: 0.5 }}>
        {typists.length > 0 && (
          <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600, fontSize: '0.65rem' }}>
            {typists.join(", ")} is typing…
          </Typography>
        )}
      </Box>

      {/* ── Input ── */}
      <Box sx={{ p: 2, pt: 1, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}>
        <form onSubmit={handleSend} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <IconButton size="small" sx={{ color: 'text.secondary', opacity: 0.7 }}>
            <AttachIcon />
          </IconButton>
          <TextField
            fullWidth
            size="small"
            value={inputText}
            onChange={handleChange}
            onBlur={() => onTyping?.(activeRoom, false)}
            placeholder="Type a message..."
            autoComplete="off"
            sx={{
              '& .MuiOutlinedInput-root': { 
                borderRadius: 7, 
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                px: 1.5,
                '& fieldset': { border: 'none' },
                '&:hover fieldset': { border: 'none' },
                '&.Mui-focused fieldset': { border: 'none' },
              }
            }}
          />
          <IconButton 
            type="submit" 
            disabled={!inputText.trim()}
            sx={{ 
              bgcolor: 'primary.main', color: '#fff', borderRadius: '50%', width: 42, height: 42,
              boxShadow: '0 4px 12px rgba(64, 138, 113, 0.3)',
              '&:hover': { bgcolor: 'primary.dark', transform: 'scale(1.05)' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled', boxShadow: 'none' },
              transition: 'all 0.2s'
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </form>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        PaperProps={{ sx: { borderRadius: 3, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Clear Chat History?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete ALL messages in this room for everyone. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} sx={{ fontWeight: 700, color: 'text.secondary' }}>
            Cancel
          </Button>
          <Button 
            onClick={() => {
              onClearChat(activeRoom);
              setConfirmOpen(false);
            }} 
            variant="contained" 
            color="error" 
            sx={{ fontWeight: 700, borderRadius: 2, px: 3 }}
          >
            Clear Everything
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
