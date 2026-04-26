const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const shippingAddressSchema = new mongoose.Schema(
  {
    city: { type: String, required: true, trim: true },
    area: { type: String, default: '', trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, default: '', trim: true },
    buildingNo: { type: String, default: '', trim: true },
    floorNo: { type: String, default: '', trim: true },
    apartmentNo: { type: String, default: '', trim: true },
    landmark: { type: String, default: '', trim: true },
    postalCode: { type: String, default: '', trim: true },
    notes: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const paymentSnapshotSchema = new mongoose.Schema(
  {
    method: { type: String, enum: ['cash_on_delivery', 'card'], required: true },
    cardBrand: { type: String, default: '', trim: true },
    cardLast4: { type: String, default: '', trim: true },
    cardHolderName: { type: String, default: '', trim: true },
    cardExpiry: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, index: true, ref: 'User' },
    orderedByUsername: { type: String, required: true, trim: true },
    orderedByRole: { type: String, enum: ['owner', 'customer'], default: 'customer' },
    customerName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    shippingAddress: { type: shippingAddressSchema, required: true },
    payment: { type: paymentSnapshotSchema, required: true },
    items: { type: [orderItemSchema], default: [] },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'shipped', 'delivered', 'returned'],
      default: 'pending',
      index: true,
    },
    statusUpdatedAt: { type: Date, default: Date.now },
    subtotal: { type: Number, required: true, min: 0 },
    shippingCost: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
