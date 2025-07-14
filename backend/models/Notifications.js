import mongoose from "mongoose";


const NotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['like', 'comment', 'follow', 'reply'], required: true },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post' }, // For post-related actions
  commentId: { type: mongoose.Schema.Types.ObjectId }, // For replies
  read: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model("Notification", NotificationSchema);