import mongoose from 'mongoose';

const ChatRoomSchema = new mongoose.Schema(
  {
    roomId:       { type: String, required: true, unique: true },
    participants: { type: [String], index: true }, // Array of user googleIds
    lastReadStatus: { 
      type: Map, 
      of: Date, 
      default: {} 
    }, // Map of googleId -> Date
    deletedBy:    { type: [String], default: [] },
    lastActivity: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Optimize room discovery and sorting (most recent first)
ChatRoomSchema.index({ participants: 1, lastActivity: -1 });

export default mongoose.models.ChatRoom || mongoose.model('ChatRoom', ChatRoomSchema);
