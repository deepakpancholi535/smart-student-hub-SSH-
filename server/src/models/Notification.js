import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['verification', 'resume', 'profile', 'account'], required: true },
    title: { type: String, required: true, maxlength: 120 },
    message: { type: String, required: true, maxlength: 400 },
    route: { type: String, maxlength: 200 },
    readAt: Date,
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
export default mongoose.model('Notification', notificationSchema);
