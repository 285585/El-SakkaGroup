const mongoose = require('mongoose');

const ownerCommunicationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    targetUsername: { type: String, default: '', trim: true },
    kind: { type: String, enum: ['order', 'sell_request', 'system'], default: 'system' },
    subject: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    relatedId: { type: String, default: '', trim: true },
    userInboxMessageId: { type: String, default: '', trim: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('OwnerCommunication', ownerCommunicationSchema);
