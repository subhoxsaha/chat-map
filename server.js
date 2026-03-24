import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server } from "socket.io";
import { connectDB } from "./src/lib/mongodb.js";
import Message from "./src/models/Message.js";
import UserLocation from "./src/models/UserLocation.js";
import User from "./src/models/User.js";
import ChatRoom from "./src/models/ChatRoom.js";

// Auto-assign a random DiceBear avatar on first account creation
const DICEBEAR_STYLES = ["lorelei","avataaars","bottts","adventurer","micah","notionists","fun-emoji","personas"];
function randomDicebear(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const style = DICEBEAR_STYLES[Math.abs(hash) % DICEBEAR_STYLES.length];
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}&radius=50&size=80`;
}

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = process.env.PORT || 3000;

// Initialize Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Helper: Haversine distance in meters
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // in meters
}

app.prepare().then(async () => {
  try {
    await connectDB();
  } catch (err) {
    console.error("Failed to connect to MongoDB:", err);
  }
  
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(port, () => {
    console.info(`>>> MapChat Production Server: Running on port ${port}`);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  // Keep track of active users & locations in-memory for fast proximity checks
  const activeUsers = new Map();

  const getUniqueUsers = () => {
    const uniqueMap = new Map();
    for (const u of activeUsers.values()) {
      // Only track users that have sent a GPS location — no ghost markers
      if (u.lat == null || u.lng == null) continue;

      const existing = uniqueMap.get(u.id);
      if (!existing) {
        uniqueMap.set(u.id, u);
      } else if (u.lastMoved > (existing.lastMoved || 0)) {
        // Same user on multiple devices — keep the most recently moved session
        uniqueMap.set(u.id, u);
      }
    }
    return Array.from(uniqueMap.values());
  };

  // ── Helper: Hydrate History with Latest DB Profiles ──
  // Ensures old messages always show the newest Name/PFP
  const hydrateHistory = async (msgs) => {
    if (!msgs || msgs.length === 0) return [];
    const senderIds = [...new Set(msgs.map(m => m.senderId).filter(Boolean))];
    const senderUsers = await User.find({ googleId: { $in: senderIds } }, "googleId name displayName customAvatar").lean();
    const senderMap = Object.fromEntries(senderUsers.map(u => [u.googleId, u]));
    return msgs.map(m => {
      const dbUser = senderMap[m.senderId];
      if (!dbUser) return m;
      return {
        ...m,
        senderName:  dbUser.displayName || dbUser.name || m.senderName,
        senderImage: dbUser.customAvatar || m.senderImage,
      };
    });
  };

  io.on("connection", (socket) => {
    // 1. User joins the map
    socket.on("user:join", async (userData) => {
      // userData: { id, name, image, lat, lng }
      // 1. Pre-register to avoid dropping user:location coordinates due to DB await race condition
      const sessionState = { ...userData, lastMoved: Date.now() };
      activeUsers.set(socket.id, sessionState);
      
      try {
        // Upsert User — never overwrite existing data, only set on first insert
        const dbUser = await User.findOneAndUpdate(
          { googleId: userData.id },
          { 
            $set: { isOnline: true, lastSeen: new Date() },
            $setOnInsert: { 
              name: userData.name, 
              email: userData.email || "",
              // Assign a random DiceBear avatar on account creation (not Google photo)
              customAvatar: randomDicebear(userData.id),
            }
          },
          { upsert: true, returnDocument: 'after' }
        ).lean();

        if (dbUser) {
          // If existing user has no customAvatar, assign one now and save
          let avatarToUse = dbUser.customAvatar;
          if (!avatarToUse) {
            avatarToUse = randomDicebear(userData.id);
            await User.updateOne({ googleId: userData.id }, { $set: { customAvatar: avatarToUse } });
          }

          const liveState = activeUsers.get(socket.id) || sessionState;
          liveState.displayName = dbUser.displayName || dbUser.name;
          liveState.customAvatar = avatarToUse;
          activeUsers.set(socket.id, liveState);
        }

        // Upsert Location
        if (userData.lat && userData.lng) {
          await UserLocation.findOneAndUpdate(
            { userId: userData.id },
            { lat: userData.lat, lng: userData.lng },
            { upsert: true }
          );
        }

        // Broadcast AFTER DB hydration so everyone sees correct name/pfp
        socket.broadcast.emit("users:update", getUniqueUsers());
        io.to(socket.id).emit("users:update", getUniqueUsers());

      } catch (err) {
        console.error("Error saving user data on join:", err);
        // Still broadcast even if DB fails
        socket.broadcast.emit("users:update", getUniqueUsers());
        io.to(socket.id).emit("users:update", getUniqueUsers());
      }

      // Auto-join global room
      socket.join("global");

      // Send recent global messages
      try {
        const recentMessages = await Message.find({ roomId: "global" })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
        const hydratedGlobal = await hydrateHistory(recentMessages.reverse());
        io.to(socket.id).emit("chat:history", { roomId: "global", messages: hydratedGlobal });

        // ── Hydrate Persistent DM Rooms from ChatRoom Collection ──
        let rooms = await ChatRoom.find({
          participants: userData.id,
          deletedBy: { $ne: userData.id }
        }).lean();

        // FALLBACK/MIGRATION: If no ChatRooms found, discover them from Messages
        if (rooms.length === 0) {
          const legacyRoomIds = await Message.distinct("roomId", {
            roomId: { $regex: `dm_.*${userData.id}.*` }
          });
          
          for (const roomId of legacyRoomIds) {
            const parts = roomId.split("_");
            const otherId = parts.find(id => id !== "dm" && id !== userData.id);
            if (otherId) {
              const newRoom = await ChatRoom.findOneAndUpdate(
                { roomId },
                { roomId, participants: [userData.id, otherId], lastActivity: new Date() },
                { upsert: true, returnDocument: 'after' }
              ).lean();
              rooms.push(newRoom);
            }
          }
        }
        
        const dmRooms = [];
        for (const room of rooms) {
          const otherId = room.participants.find(id => id !== userData.id);
          if (otherId) {
            const otherUser = await User.findOne({ googleId: otherId }).lean();
            if (otherUser) {
              dmRooms.push({
                roomId: room.roomId,
                withUserId: otherId,
                withName: otherUser.displayName || otherUser.name,
                withImage: otherUser.customAvatar || randomDicebear(otherId),
                lastRead: room.lastReadStatus?.[userData.id] || 0,
              });
            }
          }
        }
        
        io.to(socket.id).emit("chat:dm_rooms", dmRooms);
        
        for (const r of dmRooms) {
          socket.join(r.roomId);
          const history = await Message.find({ roomId: r.roomId })
            .sort({ createdAt: -1 }).limit(50).lean();
          const hydratedDm = await hydrateHistory(history.reverse());
          io.to(socket.id).emit("chat:history", { roomId: r.roomId, messages: hydratedDm });
        }
      } catch (err) {
        console.error("Error in chat hydration:", err);
      }
    });

    // 1.5 Mark as read
    socket.on("chat:mark_read", async ({ roomId }) => {
      const session = activeUsers.get(socket.id);
      if (!session || !roomId) return;
      try {
        await ChatRoom.findOneAndUpdate(
          { roomId },
          { [`lastReadStatus.${session.id}`]: new Date() }
        );
      } catch (err) {
        console.error("Error marking as read:", err);
      }
    });

    // 2. Location updates
    socket.on("user:location", async (coords) => {
      // coords: { lat, lng }
      const user = activeUsers.get(socket.id);
      if (!user) return;

      user.lat = coords.lat;
      user.lng = coords.lng;
      user.lastMoved = Date.now();
      activeUsers.set(socket.id, user);

      try {
        await UserLocation.findOneAndUpdate(
          { userId: user.id },
          { lat: coords.lat, lng: coords.lng },
          { upsert: true }
        );
      } catch (err) {
        console.error("Error updating location:", err);
      }

      // Broadcast new location
      socket.broadcast.emit("users:update", getUniqueUsers());
    });

    // 3. Chat Messages
    socket.on("chat:message", async (data) => {
      if (!data || typeof data.text !== "string" || !data.text.trim()) return;
      if (data.text.length > 2000) data.text = data.text.slice(0, 2000);
      if (data.senderName && data.senderName.length > 50) data.senderName = data.senderName.slice(0, 50);

      const session = activeUsers.get(socket.id);
      if (!session) return;

      const newMsg = new Message({
        roomId: data.roomId,
        senderId: session.id,
        senderName: session.displayName || session.name,
        senderImage: session.customAvatar,
        text: data.text,
      });

      try {
        await newMsg.save();

        // ── Ensure ChatRoom exists and is active for DMs ──
        if (data.roomId.startsWith("dm_")) {
          const parts = data.roomId.split("_");
          const otherId = parts.find(id => id !== "dm" && id !== session.id);
          if (otherId) {
            await ChatRoom.findOneAndUpdate(
              { roomId: data.roomId },
              { 
                roomId: data.roomId, 
                participants: [session.id, otherId],
                $pull: { deletedBy: { $in: [session.id, otherId] } }, // Un-hide for both on new message
                lastActivity: new Date()
              },
              { upsert: true }
            );
          }
        }
      } catch (err) {
        console.error("Error saving message or updating room:", err);
      }

      const messageToEmit = {
        id: newMsg._id.toString(),
        roomId: newMsg.roomId,
        senderId: newMsg.senderId,
        senderName: newMsg.senderName,
        senderImage: newMsg.senderImage,
        text: newMsg.text,
        timestamp: newMsg.createdAt.toISOString(),
      };

      io.to(data.roomId).emit("chat:message", messageToEmit);
    });

    // 4. Clear chat (Bulk delete)
    socket.on("chat:clear", async ({ roomId }) => {
      try {
        await Message.deleteMany({ roomId });
        io.to(roomId).emit("chat:cleared", { roomId });
      } catch (err) {
        console.error("Error clearing chat:", err);
      }
    });

    // 4.5 Leave chat (Hide room for self)
    socket.on("chat:leave", async ({ roomId }) => {
      try {
        const user = activeUsers.get(socket.id);
        if (!user) return;
        await ChatRoom.findOneAndUpdate(
          { roomId },
          { $addToSet: { deletedBy: user.id } }
        );
      } catch (err) {
        console.error("Error leaving chat:", err);
      }
    });

    // 5. Delete message (Single delete)
    socket.on("chat:delete", async ({ messageId, roomId }) => {
      try {
        await Message.findByIdAndDelete(messageId);
        io.to(roomId).emit("chat:deleted", { messageId, roomId });
      } catch (err) {
        console.error("Error deleting message:", err);
      }
    });

    // 4. Typing indicator
    socket.on("chat:typing", (data) => {
      socket.to(data.roomId).emit("chat:typing", data);
    });

    // 5. Open a DM room between caller and target user
    socket.on("dm:open", async ({ targetUserId }) => {
      const self = activeUsers.get(socket.id);
      if (!self || !targetUserId) return;

      // Stable room ID: always sort so both sides get same string
      const roomId = ["dm", ...[self.id, targetUserId].sort()].join("_");

      // UPSERT ChatRoom thread for persistence
      await ChatRoom.findOneAndUpdate(
        { roomId },
        { 
          roomId, 
          participants: [self.id, targetUserId],
          $pull: { deletedBy: { $in: [self.id, targetUserId] } }, // Un-hide for both if it was hidden
          lastActivity: new Date()
        },
        { upsert: true }
      );

      // Join caller into DM room
      socket.join(roomId);

      // Find the target's socket and join them too (silent, they'll receive dm:opened)
      for (const [sid, u] of activeUsers.entries()) {
        if (u.id === targetUserId) {
          const targetSocket = io.sockets.sockets.get(sid);
          if (targetSocket) {
            targetSocket.join(roomId);
            // Notify target that someone opened a DM
            targetSocket.emit("dm:opened", { roomId, from: { id: self.id, name: self.displayName || self.name, image: self.customAvatar } });
          }
        }
      }

      // Send DM history to caller
      try {
        const history = await Message.find({ roomId })
          .sort({ createdAt: -1 }).limit(50).lean();
        const hydrated = await hydrateHistory(history.reverse());
        socket.emit("chat:history", { roomId, messages: hydrated });
        
        // Auto-mark as read on open
        await ChatRoom.findOneAndUpdate(
          { roomId },
          { [`lastReadStatus.${session.id}`]: new Date() }
        );
      } catch (err) {
        console.error("Error fetching DM history:", err);
      }

      // Tell caller the room is ready
      socket.emit("dm:opened", { roomId, with: { id: targetUserId } });
    });

    // 6. Profile update broadcast
    socket.on("profile:update", ({ customAvatar, displayName }) => {
      const user = activeUsers.get(socket.id);
      if (!user) return;
      
      if (typeof customAvatar === "string") user.customAvatar = customAvatar;
      if (typeof displayName === "string") user.displayName = displayName.slice(0, 40);
      
      activeUsers.set(socket.id, user);
      io.emit("users:update", getUniqueUsers());
      // Instantly update local message state on all clients
      io.emit("chat:profile_updated", { userId: user.id, customAvatar, displayName });
    });

    // 7. Disconnect
    socket.on("disconnect", async () => {
      const user = activeUsers.get(socket.id);
      if (user) {
        try {
          await User.findOneAndUpdate(
            { googleId: user.id },
            { isOnline: false, lastSeen: new Date() }
          );
        } catch (err) {
          console.error("Error updating offline status:", err);
        }
      }
      activeUsers.delete(socket.id);
      io.emit("users:update", getUniqueUsers());
    });
  });
});
