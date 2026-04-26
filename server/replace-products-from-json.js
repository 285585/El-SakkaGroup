const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/product.model');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const run = async () => {
  const filePath = path.join(__dirname, 'data', 'products.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const products = JSON.parse(raw);
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/el_sakka_store';
  const dbName = String(process.env.MONGODB_DB_NAME || '').trim();
  const options = dbName ? { dbName } : {};

  await mongoose.connect(mongoUri, options);
  await Product.deleteMany({});
  await Product.insertMany(products, { ordered: true });

  const total = await Product.countDocuments();
  console.log(`[DONE] Products replaced. Count: ${total}`);
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error('[ERROR] Failed to replace products from JSON:', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
