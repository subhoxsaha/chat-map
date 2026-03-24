import { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";

let socket = null;

export function useSocket(sessionUser) {
  const [isConnected, setIsConnected]   = useState(false);
  const [users, setUsers]               = useState([]);
  const [messages, setMessages]         = useState([]);
  const [typingUsers, setTypingUsers]   = useState({});
  const [socketError, setSocketError]   = useState(null);
  const [lastRead, setLastRead]           = useState({}); // { roomId: timestamp }
  const [dmRooms, setDmRooms]           = useState([]); // [{ roomId, withUserId, withName }]
  const LS_KEY = `mapchat_dms_v2_${sessionUser?.id}`;

  const markRead = useCallback((roomId) => {
    if (!socket?.connected) return;
    socket.emit("chat:mark_read", { roomId });
    setLastRead(prev => ({ ...prev, [roomId]: Date.now() }));
  }, [socket]);

  // ── Sync lastRead with server rooms ──
  useEffect(() => {
    if (dmRooms.length > 0) {
      const newRead = { ...lastRead };
      let changed = false;
      dmRooms.forEach(r => {
        if (r.lastRead) {
          const ts = new Date(r.lastRead).getTime();
          if (!newRead[r.roomId] || ts > newRead[r.roomId]) {
            newRead[r.roomId] = ts;
            changed = true;
          }
        }
      });
      if (changed) setLastRead(newRead);
    }
  }, [dmRooms]);

  // Use localStorage ONLY as an initial cache for instant-load
  useEffect(() => {
    if (!sessionUser?.id) return;
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      try { setDmRooms(JSON.parse(saved)); }
      catch (e) { console.error("Failed to load DMs cache", e); }
    }
  }, [sessionUser?.id, LS_KEY]);

  // Persist the latest authoritative list whenever it changes
  useEffect(() => {
    if (sessionUser?.id && dmRooms.length > 0) {
      localStorage.setItem(LS_KEY, JSON.stringify(dmRooms));
    }
  }, [dmRooms, sessionUser?.id, LS_KEY]);

  useEffect(() => {
    if (!sessionUser?.id) return;
    if (socket?.connected) socket.disconnect();

    socket = io({ path: "/socket.io", reconnection: true, reconnectionDelay: 2000 });

    socket.on("connect", () => {
      setIsConnected(true);
      setSocketError(null);
      socket.emit("user:join", {
        id:           sessionUser.id,
        name:         sessionUser.name,
        displayName:  sessionUser.name,   // overridden by server from DB
        email:        sessionUser.email,
        image:        sessionUser.image || "",
        customAvatar: sessionUser.customAvatar || "",
      });
    });

    socket.on("connect_error", err => setSocketError(err.message));

    socket.on("disconnect", reason => {
      setIsConnected(false);
      if (reason === "io server disconnect") setSocketError("Disconnected by server.");
    });

    socket.on("users:update", updatedUsers => setUsers(updatedUsers));

    socket.on("chat:history", ({ roomId, messages: history }) => {
      const normalized = history.map(m => ({
        ...m,
        id:        m._id || m.id,
        timestamp: m.createdAt || m.timestamp,
      }));
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const fresh = normalized.filter(m => !existingIds.has(m.id));
        return [...prev, ...fresh].sort((a, b) => {
          const ta = new Date(a.timestamp || a.createdAt).getTime();
          const tb = new Date(b.timestamp || b.createdAt).getTime();
          return ta - tb;
        });
      });
    });

    socket.on("chat:message", message => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    socket.on("chat:deleted", ({ messageId }) => {
      setMessages(prev => prev.filter(m => m.id !== messageId));
    });

    socket.on("chat:cleared", ({ roomId }) => {
      setMessages(prev => prev.filter(m => m.roomId !== roomId));
    });

    socket.on("chat:profile_updated", ({ userId, customAvatar, displayName }) => {
      setMessages(prev => prev.map(m => {
        if (m.senderId === userId) {
          return {
            ...m,
            senderName: displayName !== undefined ? displayName : m.senderName,
            senderImage: customAvatar !== undefined ? customAvatar : m.senderImage,
            senderCustomAvatar: customAvatar !== undefined ? customAvatar : m.senderCustomAvatar
          };
        }
        return m;
      }));

      // ALSO update name and PFP in the Sidebar (dmRooms)
      setDmRooms(prev => prev.map(r => {
        if (r.withUserId === userId) {
          return {
            ...r,
            withName: displayName !== undefined ? displayName : r.withName,
            withImage: customAvatar !== undefined ? customAvatar : r.withImage
          };
        }
        return r;
      }));
    });

    socket.on("chat:typing", ({ roomId, username, isTyping }) => {
      setTypingUsers(prev => ({
        ...prev,
        [roomId]: { ...(prev[roomId] || {}), [username]: isTyping },
      }));
    });

    // Incoming DM notification (other user opened a DM with us)
    socket.on("dm:opened", ({ roomId, from }) => {
      if (!from) return; // we opened it, server sent back confirmation
      setDmRooms(prev =>
        prev.some(r => r.roomId === roomId)
          ? prev
          : [...prev, { roomId, withUserId: from.id, withName: from.name, withImage: from.image }]
      );
    });

    socket.on("chat:dm_rooms", (rooms) => {
      setDmRooms(rooms);
    });

    return () => {
      socket?.off(); // Remove all listeners
      socket?.disconnect();
      socket = null;
    };
  }, [sessionUser?.id]);

  const sendMessage = useCallback((text, roomId) => {
    if (!socket?.connected || !sessionUser) return;
    socket.emit("chat:message", {
      text, roomId,
      senderId:    sessionUser.id,
      senderName:  sessionUser.name, // this is the effective name (DB displayName || name)
      senderImage: sessionUser.customAvatar || "",
    });
  }, [sessionUser]);

  const updateLocation = useCallback((lat, lng) => {
    socket?.connected && socket.emit("user:location", { lat, lng });
  }, []);

  const setTyping = useCallback((roomId, isTyping) => {
    socket?.connected && socket.emit("chat:typing", { roomId, isTyping, username: sessionUser?.name });
  }, [sessionUser]);

  // Open (or reopen) a DM with another user
  const openDm = useCallback((targetUserId, targetName, targetImage) => {
    if (!socket?.connected || !sessionUser) return;
    socket.emit("dm:open", { targetUserId });
    const roomId = ["dm", ...[sessionUser.id, targetUserId].sort()].join("_");
    setDmRooms(prev =>
      prev.some(r => r.roomId === roomId)
        ? prev
        : [...prev, { roomId, withUserId: targetUserId, withName: targetName, withImage: targetImage }]
    );
    return roomId;
  }, [sessionUser.id]);

  // Broadcast profile change to all users in real-time
  const broadcastProfile = useCallback(({ customAvatar, displayName }) => {
    socket?.connected && socket.emit("profile:update", { customAvatar, displayName });
  }, []);

  const deleteMessage = useCallback((messageId, roomId) => {
    socket?.connected && socket.emit("chat:delete", { messageId, roomId });
  }, []);

  const leaveChat = useCallback((roomId) => {
    setDmRooms(prev => prev.filter(r => r.roomId !== roomId));
    socket?.connected && socket.emit("chat:leave", { roomId });
  }, []);

  const clearChat = useCallback((roomId) => {
    socket?.connected && socket.emit("chat:clear", { roomId });
  }, []);

  return {
    isConnected, users, messages, typingUsers, socketError,
    dmRooms, lastRead, sendMessage, updateLocation, setTyping, openDm, broadcastProfile, deleteMessage, leaveChat, clearChat, markRead,
  };
}
