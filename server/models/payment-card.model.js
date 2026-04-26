const mongoose = require('mongoose');

const paymentCardSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true, ref: 'User' },
    cardHolderName: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    last4: { type: String, required: true, trim: true },
    expiryMonth: { type: Number, required: true, min: 1, max: 12 },
    expiryYear: { type: Number, required: true, min: 2024 },
    tokenId: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PaymentCard', paymentCardSchema);
