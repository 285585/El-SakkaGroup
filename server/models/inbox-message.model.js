const mongoose = require('mongoose');

const inboxMessageSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    kind: { type: String, enum: ['order', 'sell_request', 'system'], default: 'system' },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    relatedId: { type: String, default: '', trim: true },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('InboxMessage', inboxMessageSchema);
