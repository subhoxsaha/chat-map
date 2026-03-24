import mongoose from 'mongoose';

const UserLocationSchema = new mongoose.Schema(
  {
    userId: {
      type: String, // Google ID matching User.googleId for easy lookup from session
      required: true,
      unique: true,
    },
    lat: {
      type: Number,
      required: true,
    },
    lng: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.models.UserLocation || mongoose.model('UserLocation', UserLocationSchema);
