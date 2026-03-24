import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      required: true,
    },
    senderName: {
      type: String,
      required: true,
    },
    senderImage: {
      type: String,
    },
    text: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index for fast history fetching: roomId + reverse chronological order
MessageSchema.index({ roomId: 1, createdAt: -1 });

// Post-save hook to enforce 27MB cap per room
MessageSchema.post('save', async function (doc) {
  const Message = this.constructor;
  
  try {
    // Calculate total size of messages in this room
    const result = await Message.aggregate([
      { $match: { roomId: doc.roomId } },
      {
        $group: {
          _id: '$roomId',
          totalSize: { $sum: { $bsonSize: '$$ROOT' } },
          count: { $sum: 1 }
        }
      }
    ]);

    if (result.length > 0) {
      const { totalSize, count } = result[0];
      const MAX_SIZE_BYTES = 27 * 1024 * 1024; // 27 MB

      if (totalSize > MAX_SIZE_BYTES) {
        console.log(`Room ${doc.roomId} exceeded 27MB (${(totalSize / 1024 / 1024).toFixed(2)}MB). Pruning old messages...`);
        
        // Find how many to delete (rough estimate: delete 10% of oldest if over limit)
        // Or strictly delete the oldest 1 by 1 until under limit. 
        // For efficiency, we delete the oldest 50 messages at a time when limit is reached.
        const messagesToDelete = await Message.find({ roomId: doc.roomId })
          .sort({ createdAt: 1 }) // oldest first
          .limit(50)
          .select('_id');

        const idsToDelete = messagesToDelete.map(m => m._id);
        await Message.deleteMany({ _id: { $in: idsToDelete } });
        console.log(`Deleted ${idsToDelete.length} old messages from room ${doc.roomId}`);
      }
    }
  } catch (err) {
    console.error('Error in Message post-save hook (size cap):', err);
  }
});

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
