import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema(
  {
    googleId:     { type: String, required: true, unique: true },
    name:         { type: String, required: true },
    email:        { type: String, required: true, unique: true },
    image:        { type: String },
    customAvatar: { type: String }, // DiceBear data-URI or URL
    displayName:  { type: String }, // user-overridden display name
    isOnline:     { type: Boolean, default: true },
    lastSeen:     { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.User || mongoose.model('User', UserSchema);
