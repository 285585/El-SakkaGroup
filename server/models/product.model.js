const mongoose = require('mongoose');

const productSpecsSchema = new mongoose.Schema(
  {
    cpu: { type: String, default: 'N/A' },
    ram: { type: String, default: 'N/A' },
    storage: { type: String, default: 'N/A' },
    display: { type: String, default: 'N/A' },
    gpu: { type: String, default: 'N/A' },
    warranty: { type: String, default: '1 Year' },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    brand: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    oldPrice: { type: Number, required: true, min: 0 },
    rating: { type: Number, required: true, min: 0, max: 5, default: 4.5 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    isFeatured: { type: Boolean, default: false },
    shortDescription: { type: String, required: true, trim: true },
    image: { type: String, default: '' },
    images: { type: [String], default: [] },
    specs: { type: productSpecsSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
