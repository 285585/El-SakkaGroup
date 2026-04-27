const mongoose = require('mongoose');

const sellRequestSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    username: { type: String, required: true, trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    cpu: { type: String, required: true, trim: true },
    ram: { type: String, required: true, trim: true },
    storage: { type: String, required: true, trim: true },
    gpu: { type: String, default: '', trim: true },
    condition: { type: String, required: true, trim: true },
    expectedPrice: { type: Number, required: true, min: 0 },
    description: { type: String, default: '', trim: true },
    images: { type: [String], default: [] },
    decision: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    ownerReply: { type: String, default: '', trim: true },
    ownerDecisionUpdatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SellRequest', sellRequestSchema);
