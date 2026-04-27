const mongoose = require('mongoose');

const productRatingSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true, trim: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User', index: true },
    value: { type: Number, required: true, min: 1, max: 5 },
    orderId: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

productRatingSchema.index({ productId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('ProductRating', productRatingSchema);
