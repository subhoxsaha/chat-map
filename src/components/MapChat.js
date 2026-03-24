"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useContext } from "react";
import { signOut } from "next-auth/react";
import { useSocket } from "@/hooks/useSocket";
import { useGeolocation } from "@/hooks/useGeolocation";
import ChatPanel from "./ChatPanel";
import ProfilePanel from "./ProfilePanel";
import dynamic from "next/dynamic";
import {
  Box, AppBar, Toolbar, Typography, Avatar, IconButton, Badge, Menu, MenuItem,
  ListItemIcon, Drawer, Button, useTheme, useMediaQuery, Alert, Snackbar
} from "@mui/material";
import {
  Edit as EditIcon,
  Logout as LogoutIcon,
  Chat as ChatIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon
} from "@mui/icons-material";
import { ColorModeContext } from "./ThemeRegistry/ThemeRegistry";

function dicebearUrl(seed) {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "background.default" }}>
      <Box sx={{ width: 40, height: 40, borderRadius: "50%", border: "4px solid", borderColor: "primary.main", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
    </Box>
  ),
});

export default function MapChat({ sessionUser }) {
  // Persistent activeRoom state
  const [activeRoom, setActiveRoom] = useState(() => {
    if (typeof window !== "undefined") return sessionStorage.getItem("mapchat_active_room") || null;
    return null;
  });

  const handleSetRoom = useCallback((room) => {
    setActiveRoom(room);
    if (room) sessionStorage.setItem("mapchat_active_room", room);
    else sessionStorage.removeItem("mapchat_active_room");
  }, []);

  const [chatOpen, setChatOpen]         = useState(false);   
  const [profileOpen, setProfileOpen]   = useState(false);   
  const [anchorEl, setAnchorEl]         = useState(null);    
  const [geoError, setGeoError]         = useState(null);
  const [errDismissed, setErrDismissed] = useState(false);
  const lastLocRef = useRef(null);
  
  const theme = useTheme();
  const colorMode = useContext(ColorModeContext);
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));

  // Initialize from sessionUser which is now DB-authoritative thanks to lib/auth.js
  const [localProfile, setLocalProfile] = useState({
    name: sessionUser?.name || "",
    customAvatar: sessionUser?.customAvatar || null,
    loaded: false,
  });

  // Authoritative identity object for all sub-components — Memoized to prevent MapView crashes
  const effectiveUser = useMemo(() => ({
    ...sessionUser,
    name: localProfile.name || sessionUser?.name || "",
    customAvatar: localProfile.customAvatar || sessionUser?.customAvatar || null,
  }), [sessionUser, localProfile.name, localProfile.customAvatar]);

  const {
    isConnected, users, messages, typingUsers, socketError,
    dmRooms, lastRead, sendMessage, updateLocation, setTyping, openDm, broadcastProfile, deleteMessage, leaveChat, clearChat, markRead,
  } = useSocket(effectiveUser);

  const handleLeaveChat = (roomId) => {
    leaveChat(roomId);
    if (activeRoom === roomId) setActiveRoom(null);
  };

  const { location, error: locError } = useGeolocation();

  // Load profile from DB — DB is the single source of truth for name + PFP
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then(({ user }) => {
        if (user) {
          setLocalProfile({
            name: user.displayName || user.name || sessionUser?.name || "",
            customAvatar: user.customAvatar || null,
            loaded: true,
          });
        }
      })
      .catch(() => {
        // Fallback to session name if API fails, but still no Google photo
        setLocalProfile(prev => ({ ...prev, name: sessionUser?.name || "", loaded: true }));
      });
  }, [sessionUser?.id]);

  // Throttled location broadcast
  useEffect(() => {
    if (!location || !isConnected) return;
    const prev = lastLocRef.current;
    const moved = !prev ||
      Math.abs(location.lat - prev.lat) > 0.0001 ||
      Math.abs(location.lng - prev.lng) > 0.0001;
    if (moved) { updateLocation(location.lat, location.lng); lastLocRef.current = location; }
  }, [location, isConnected, updateLocation]);

  useEffect(() => {
    if (locError && !errDismissed) setGeoError(locError);
  }, [locError, errDismissed]);

  const handleOpenDm = useCallback((targetUserId, targetName, targetImage) => {
    const roomId = openDm(targetUserId, targetName, targetImage);
    handleSetRoom(roomId);
    if (!isDesktop) setChatOpen(true);
  }, [openDm, isDesktop, handleSetRoom]);

  const handleProfileSaved = useCallback(({ customAvatar, displayName }) => {
    setLocalProfile(prev => ({
      ...prev,
      name: displayName || prev.name,
      customAvatar: customAvatar !== undefined ? customAvatar : prev.customAvatar,
    }));
    broadcastProfile({ customAvatar, displayName });
    setProfileOpen(false);
  }, [broadcastProfile]);

  // Total unread for the FAB badge (all rooms except active one if open)
  const totalUnread = messages.filter(m => {
    const isAtActive = (chatOpen || isDesktop) && m.roomId === activeRoom;
    if (isAtActive) return false;
    const lastTime = lastRead[m.roomId] || 0;
    return new Date(m.timestamp || m.createdAt).getTime() > lastTime;
  }).length;

  // effectiveUser declaration moved above useSocket for dependency chaining

  const handleMenuOpen = (event) => setAnchorEl(event.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const errorMessage = geoError || socketError;

  // Memoize users passed to map to prevent Leaflet 'appendChild' errors on every re-render
  const mapUsers = useMemo(() => {
    return users.map(u =>
      u.id === sessionUser?.id
        ? { ...u, displayName: localProfile.name, customAvatar: localProfile.customAvatar || undefined, image: localProfile.image }
        : u
    );
  }, [users, localProfile, sessionUser?.id]);

  // Memoize handlers passed to MapView
  const handleMapUserClick = useCallback((id, name, img) => {
    handleOpenDm(id, name, img);
  }, [handleOpenDm]);

  return (
    <Box sx={{ position: "relative", width: "100%", height: "100dvh", overflow: "hidden", bgcolor: "background.default" }}>
      
      {/* ── Full-screen map ── */}
      <Box sx={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <MapView
          users={mapUsers}
          sessionUser={effectiveUser}
          userLocation={location}
          mapTheme={theme.palette.mode}
          onUserClick={handleMapUserClick}
        />
      </Box>

      {/* ══ TOP NAVBAR ══ */}
      <AppBar 
        position="absolute"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
          zIndex: theme.zIndex.drawer + 1,
          ...(theme.palette.mode === 'dark' && {
            bgcolor: 'rgba(9, 20, 19, 0.8)',
          })
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between", minHeight: { xs: 56, sm: 64 } }}>
          
          {/* Brand & Status */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box 
              component="img"
              src="/logo.png"
              sx={{ 
                width: 38, height: 38, 
                filter: 'drop-shadow(0 2px 4px rgba(64,138,113,0.2))',
                borderRadius: '10px'
              }}
            />
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.5px', lineHeight: 1, color: "text.primary", fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>
                Map Chat
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                <Box sx={{ 
                  width: 7, height: 7, borderRadius: "50%", 
                  bgcolor: isConnected ? "success.main" : "warning.main",
                  boxShadow: isConnected ? '0 0 8px rgba(46, 125, 50, 0.5)' : 'none'
                }} />
                <Typography variant="caption" sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.secondary", opacity: 0.8 }}>
                  {isConnected ? `${users.length} Active` : "Connecting..."}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Right Actions */}
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1, sm: 2 } }}>
            
            {/* Theme Toggle */}
            <IconButton 
              onClick={colorMode.toggleColorMode} 
              sx={{ 
                color: "text.secondary", border: '1px solid', borderColor: 'divider', borderRadius: 2.5,
                bgcolor: 'background.default', '&:hover': { bgcolor: 'action.hover' }
              }}
            >
              {theme.palette.mode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>

            {/* Profile Dropdown */}
            <Box onClick={handleMenuOpen} sx={{ 
              cursor: "pointer", transition: 'all 0.23s', 
              '&:hover': { transform: 'scale(1.05)' },
              '&:active': { transform: 'scale(0.95)' }
            }}>
              <Box sx={{ position: 'relative' }}>
                <Avatar 
                  src={localProfile.customAvatar || dicebearUrl(sessionUser?.id || "default")} 
                  sx={{ 
                    width: 42, height: 42, border: '2px solid', borderColor: 'primary.main', 
                    boxShadow: '0 4px 12px rgba(64, 138, 113, 0.2)',
                    transition: 'border-color 0.2s',
                    opacity: localProfile.loaded ? 1 : 0, // Fade in once DB is ready
                  }}
                />
                <Box sx={{ 
                  position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, 
                  bgcolor: 'success.main', border: '2px solid', borderColor: 'background.paper', 
                  borderRadius: '50%', boxShadow: '0 0 5px rgba(0,0,0,0.2)' 
                }} />
              </Box>
            </Box>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleMenuClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{
                paper: {
                  elevation: 10,
                  sx: { 
                    mt: 1.5, width: 240, borderRadius: 3, 
                    border: '1px solid', borderColor: 'divider', 
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                    backgroundImage: 'none'
                  }
                }
              }}
            >
              <Box sx={{ px: 2, py: 2, borderBottom: "1px solid", borderColor: "divider", bgcolor: 'rgba(0,0,0,0.02)' }}>
                <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, color: 'text.primary' }}>{localProfile.name}</Typography>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ opacity: 0.8 }}>{sessionUser?.email}</Typography>
              </Box>
              <Box sx={{ p: 1 }}>
                <MenuItem onClick={() => { handleMenuClose(); setProfileOpen(true); }} sx={{ borderRadius: 2, py: 1.2, '&:hover': { bgcolor: 'primary.transparent' } }}>
                  <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                  <Typography variant="body2" fontWeight={600}>Edit Profile</Typography>
                </MenuItem>
                <MenuItem onClick={() => signOut({ callbackUrl: "/login" })} sx={{ borderRadius: 2, py: 1.2, color: "error.main", mt: 0.5 }}>
                  <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                  <Typography variant="body2" fontWeight={600}>Sign out</Typography>
                </MenuItem>
              </Box>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Dismiss-able error banner */}
      <Snackbar
        open={Boolean(errorMessage) && !errDismissed}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ top: { xs: 80, sm: 90 } }}
      >
        <Alert severity="warning" onClose={() => setErrDismissed(true)} sx={{ borderRadius: 3, boxShadow: theme.shadows[4] }}>
          {errorMessage}
        </Alert>
      </Snackbar>

      {/* ══ MOBILE: Chat Button ══ */}
      {!isDesktop && (
        <Box sx={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 40 }}>
          <Badge badgeContent={totalUnread} color="error" sx={{ '& .MuiBadge-badge': { right: 4, top: 4 } }}>
            <Button 
              variant="contained"
              onClick={() => { setChatOpen(true); handleSetRoom(null); }}
              startIcon={<ChatIcon sx={{ fontSize: '1.1rem' }} />}
              sx={{ 
                bgcolor: "primary.main", color: "#fff", 
                height: 38, width: 180, borderRadius: 3,
                fontWeight: 800, fontSize: '0.78rem', textTransform: 'uppercase',
                letterSpacing: '0.6px',
                boxShadow: '0 6px 20px rgba(64,138,113,0.3)',
                "&:hover": { bgcolor: "primary.dark", transform: 'translateY(-1px)' },
                transition: 'all 0.2s'
              }}
            >
              Open Chats
            </Button>
          </Badge>
        </Box>
      )}

      {/* ══ MOBILE: Bottom sheet Drawer ══ */}
      <Drawer
        anchor="bottom"
        open={chatOpen && !isDesktop}
        onClose={() => setChatOpen(false)}
        PaperProps={{
          sx: { 
            height: "100dvh", borderTopLeftRadius: 24, borderTopRightRadius: 24, 
            bgcolor: "background.paper", backgroundImage: "none",
            pt: { xs: '56px', sm: '64px' }
          }
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1.5, pb: 1 }}>
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider" }} />
        </Box>
        <ChatPanel
          users={users} messages={messages} typingUsers={typingUsers}
          activeRoom={activeRoom} onRoomChange={setActiveRoom}
          onSendMessage={sendMessage} onTyping={setTyping}
          deleteMessage={deleteMessage}
          sessionUser={sessionUser} dmRooms={dmRooms}
          onClose={() => setChatOpen(false)}
          onLeaveChat={handleLeaveChat}
          onClearChat={clearChat}
          lastRead={lastRead}
          onMarkRead={markRead}
        />
      </Drawer>

      {/* ══ DESKTOP: Side panel ══ */}
      {isDesktop && (
        <Box sx={{ 
          position: "absolute", top: { xs: 56, sm: 64 }, right: 0, bottom: 0, zIndex: 30, 
          width: 400, bgcolor: "background.paper", borderLeft: "1px solid", borderColor: "divider",
          boxShadow: theme.shadows[10], display: "flex", flexDirection: "column"
        }}>
          <ChatPanel
            users={users} messages={messages} typingUsers={typingUsers}
            activeRoom={activeRoom} onRoomChange={handleSetRoom}
            onSendMessage={sendMessage} onTyping={setTyping}
            deleteMessage={deleteMessage}
            sessionUser={sessionUser} dmRooms={dmRooms}
            lastRead={lastRead}
            onLeaveChat={handleLeaveChat}
            onClearChat={clearChat}
            onMarkRead={markRead}
          />
        </Box>
      )}

      {/* ══ Profile dialog ══ */}
      <ProfilePanel
        open={profileOpen}
        sessionUser={sessionUser}
        onClose={() => setProfileOpen(false)}
        onProfileSaved={handleProfileSaved}
      />
    </Box>
  );
}
