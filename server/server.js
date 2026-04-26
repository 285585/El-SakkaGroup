const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Product = require('./models/product.model');
const Order = require('./models/order.model');

dotenv.config();

const app = express();

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const PORT = Number(process.env.PORT || 3000);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const FRONTEND_DIST_DIR = process.env.FRONTEND_DIST_DIR
  ? path.resolve(process.env.FRONTEND_DIST_DIR)
  : path.join(PROJECT_ROOT, 'dist', 'e-commerce');
const FRONTEND_INDEX_FILE = path.join(FRONTEND_DIST_DIR, 'index.html');
const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(__dirname, 'data');
const LEGACY_PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const LEGACY_ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const UPLOADS_DIR = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, 'uploads');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/el_sakka_store';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || '';
const SEED_FROM_JSON = String(process.env.SEED_FROM_JSON || 'true').toLowerCase() !== 'false';

const OWNER_USERNAME = process.env.OWNER_USERNAME || 'elsakka';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || 'elsakkagroup';
const OWNER_JWT_SECRET =
  process.env.OWNER_JWT_SECRET || 'please-change-owner-jwt-secret-in-production';
const OWNER_TOKEN_TTL = process.env.OWNER_TOKEN_TTL || '7d';
const SERVE_FRONTEND = String(process.env.SERVE_FRONTEND || 'true').toLowerCase() !== 'false';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

let frontendBuildExists = false;

const normalizeText = (value) => String(value || '').trim().toLowerCase();
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};
const toBoolean = (value) => ['true', '1', 'yes', 'on'].includes(normalizeText(value));

const slugify = (value) =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const generateProductId = (name) => {
  const base = slugify(name) || 'product';
  return `${base}-${Date.now().toString(36)}`;
};

const sanitizeName = (name) =>
  name
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9-_.]/g, '')
    .toLowerCase();

const createOwnerToken = (username) =>
  jwt.sign({ username, role: 'owner' }, OWNER_JWT_SECRET, {
    expiresIn: OWNER_TOKEN_TTL,
  });

const readJson = async (filePath, fallbackValue) => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallbackValue;
    }

    throw error;
  }
};

const removeUploadedFile = async (file) => {
  if (!file) {
    return;
  }

  await fs.unlink(file.path).catch(() => undefined);
};

const isLocalUploadPath = (imagePath) =>
  typeof imagePath === 'string' && imagePath.startsWith('/api/uploads/');

const removeUploadedImageByPath = async (imagePath) => {
  if (!isLocalUploadPath(imagePath)) {
    return;
  }

  const fileName = path.basename(imagePath);
  const filePath = path.join(UPLOADS_DIR, fileName);
  await fs.unlink(filePath).catch(() => undefined);
};

const getTokenFromRequest = (request) => {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer ')) {
    return null;
  }

  return authorization.slice('Bearer '.length).trim();
};

const requireOwnerAuth = (request, response, next) => {
  const token = getTokenFromRequest(request);

  if (!token) {
    response.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const payload = jwt.verify(token, OWNER_JWT_SECRET);
    request.owner = {
      username: payload.username,
      role: payload.role,
    };
    next();
  } catch {
    response.status(401).json({ message: 'Unauthorized.' });
  }
};

const buildProductImages = (product) => {
  if (Array.isArray(product?.images) && product.images.length > 0) {
    return product.images;
  }

  if (typeof product?.image === 'string' && product.image.trim()) {
    return [product.image];
  }

  return [];
};

const normalizeProductImages = (product) => {
  const images = buildProductImages(product);
  return {
    ...product,
    image: images[0] || '',
    images,
  };
};

const normalizeProductDocument = (product) => {
  const plainProduct = typeof product?.toObject === 'function' ? product.toObject() : product;
  return normalizeProductImages(plainProduct);
};

const applyProductFilters = (products, query) => {
  const search = normalizeText(query.search);
  const brand = normalizeText(query.brand || 'all');
  const sort = normalizeText(query.sort || 'featured');
  const minPrice = query.minPrice ? Number(query.minPrice) : null;
  const maxPrice = query.maxPrice ? Number(query.maxPrice) : null;

  let filtered = [...products];

  if (search) {
    filtered = filtered.filter((product) => {
      const searchable = [
        product.id,
        product.name,
        product.brand,
        product.shortDescription,
        product.specs?.cpu,
        product.specs?.gpu,
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(search);
    });
  }

  if (brand !== 'all') {
    filtered = filtered.filter(
      (product) => normalizeText(product.brand) === brand
    );
  }

  if (minPrice !== null && !Number.isNaN(minPrice)) {
    filtered = filtered.filter((product) => product.price >= minPrice);
  }

  if (maxPrice !== null && !Number.isNaN(maxPrice)) {
    filtered = filtered.filter((product) => product.price <= maxPrice);
  }

  switch (sort) {
    case 'priceasc':
      filtered.sort((a, b) => a.price - b.price);
      break;
    case 'pricedesc':
      filtered.sort((a, b) => b.price - a.price);
      break;
    case 'rating':
      filtered.sort((a, b) => b.rating - a.rating);
      break;
    default:
      filtered.sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured));
      break;
  }

  return filtered;
};

const ensureUploadsDirectory = async () => {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
};

const ensureFrontendBuild = async () => {
  try {
    await fs.access(FRONTEND_INDEX_FILE);
    return true;
  } catch {
    return false;
  }
};

const connectMongo = async () => {
  const options = {};
  if (MONGODB_DB_NAME) {
    options.dbName = MONGODB_DB_NAME;
  }

  await mongoose.connect(MONGODB_URI, options);
};

const seedCollectionFromLegacyJson = async () => {
  if (!SEED_FROM_JSON) {
    return;
  }

  const productCount = await Product.estimatedDocumentCount();
  if (productCount === 0) {
    const legacyProducts = await readJson(LEGACY_PRODUCTS_FILE, []);
    if (Array.isArray(legacyProducts) && legacyProducts.length > 0) {
      const normalizedProducts = legacyProducts.map((product) => {
        const images = buildProductImages(product);
        return {
          id: String(product.id || generateProductId(product.name || 'product')),
          name: String(product.name || '').trim(),
          brand: String(product.brand || '').trim(),
          category: String(product.category || '').trim(),
          price: toNumber(product.price, 0),
          oldPrice: toNumber(product.oldPrice, toNumber(product.price, 0)),
          rating: toNumber(product.rating, 4.5),
          stock: toNumber(product.stock, 0),
          isFeatured: Boolean(product.isFeatured),
          shortDescription: String(product.shortDescription || '').trim(),
          image: images[0] || '',
          images,
          specs: {
            cpu: String(product.specs?.cpu || 'N/A').trim(),
            ram: String(product.specs?.ram || 'N/A').trim(),
            storage: String(product.specs?.storage || 'N/A').trim(),
            display: String(product.specs?.display || 'N/A').trim(),
            gpu: String(product.specs?.gpu || 'N/A').trim(),
            warranty: String(product.specs?.warranty || '1 Year').trim(),
          },
        };
      });

      await Product.insertMany(normalizedProducts, { ordered: false });
      console.log(`[SEED] Seeded ${normalizedProducts.length} products from legacy JSON`);
    }
  }

  const orderCount = await Order.estimatedDocumentCount();
  if (orderCount === 0) {
    const legacyOrders = await readJson(LEGACY_ORDERS_FILE, []);
    if (Array.isArray(legacyOrders) && legacyOrders.length > 0) {
      const normalizedOrders = legacyOrders.map((order) => ({
        id: String(order.id || `ESG-${Date.now()}`),
        customerName: String(order.customerName || '').trim(),
        email: String(order.email || '').trim(),
        phone: String(order.phone || '').trim(),
        city: String(order.city || '').trim(),
        address: String(order.address || '').trim(),
        items: Array.isArray(order.items)
          ? order.items.map((item) => ({
              productId: String(item.productId || '').trim(),
              name: String(item.name || '').trim(),
              quantity: toNumber(item.quantity, 1),
              unitPrice: toNumber(item.unitPrice, 0),
              lineTotal: toNumber(item.lineTotal, 0),
            }))
          : [],
        subtotal: toNumber(order.subtotal, 0),
        shippingCost: toNumber(order.shippingCost, 0),
        total: toNumber(order.total, 0),
        createdAt: order.createdAt || undefined,
      }));

      await Order.insertMany(normalizedOrders, { ordered: false });
      console.log(`[SEED] Seeded ${normalizedOrders.length} orders from legacy JSON`);
    }
  }
};

const imageStorage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, UPLOADS_DIR);
  },
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const baseName = sanitizeName(path.basename(file.originalname, extension)) || 'laptop';
    callback(null, `${Date.now()}-${baseName}${extension}`);
  },
});

const upload = multer({
  storage: imageStorage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    callback(null, IMAGE_EXTENSIONS.has(extension));
  },
});

const productUploadMiddleware = upload.fields([
  { name: 'images', maxCount: 200 },
  { name: 'image', maxCount: 1 },
]);

const extractUploadedImageFiles = (request) => {
  const files = request.files;
  if (!files) {
    return [];
  }

  if (Array.isArray(files)) {
    return files;
  }

  return [...(files.images || []), ...(files.image || [])];
};

const removeUploadedFiles = async (files) => {
  if (!Array.isArray(files) || files.length === 0) {
    return;
  }

  await Promise.all(files.map((file) => removeUploadedFile(file)));
};

app.set('trust proxy', 1);
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  })
);
app.use(compression());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsOrigins.length === 0 || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('CORS_NOT_ALLOWED'));
    },
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(morgan(IS_PRODUCTION ? 'combined' : 'dev'));
app.use('/api/uploads', express.static(UPLOADS_DIR));

app.get('/api/health', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'El-Sakka Group API',
    environment: NODE_ENV,
    databaseState: mongoose.connection.readyState,
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/auth/login', (request, response) => {
  const { username, password } = request.body || {};

  if (username !== OWNER_USERNAME || password !== OWNER_PASSWORD) {
    response.status(401).json({ message: 'Invalid owner credentials.' });
    return;
  }

  const token = createOwnerToken(username);
  response.json({
    token,
    owner: {
      username,
    },
  });
});

app.get('/api/auth/session', requireOwnerAuth, (request, response) => {
  response.json({
    owner: request.owner,
  });
});

app.get('/api/brands', async (_request, response, next) => {
  try {
    const brands = await Product.distinct('brand');
    response.json(brands.sort());
  } catch (error) {
    next(error);
  }
});

app.get('/api/products', async (request, response, next) => {
  try {
    const products = (await Product.find({}).lean()).map(normalizeProductImages);
    const filteredProducts = applyProductFilters(products, request.query);

    response.json({
      total: filteredProducts.length,
      products: filteredProducts,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/products/:id', async (request, response, next) => {
  try {
    const product = await Product.findOne({ id: request.params.id }).lean();
    if (!product) {
      response.status(404).json({ message: 'Product not found.' });
      return;
    }

    response.json(normalizeProductImages(product));
  } catch (error) {
    next(error);
  }
});

app.post(
  '/api/admin/products',
  requireOwnerAuth,
  productUploadMiddleware,
  async (request, response, next) => {
    try {
      const uploadedImageFiles = extractUploadedImageFiles(request);
      const {
        name,
        brand,
        category,
        price,
        oldPrice,
        rating,
        stock,
        isFeatured,
        shortDescription,
        cpu,
        ram,
        storage,
        display,
        gpu,
        warranty,
      } = request.body;

      if (!name || !brand || !category || !price || !shortDescription) {
        await removeUploadedFiles(uploadedImageFiles);
        response.status(400).json({ message: 'Missing required product fields.' });
        return;
      }

      if (uploadedImageFiles.length === 0) {
        response.status(400).json({ message: 'At least one product image is required.' });
        return;
      }

      const normalizedPrice = toNumber(price, 0);
      if (normalizedPrice <= 0) {
        await removeUploadedFiles(uploadedImageFiles);
        response.status(400).json({ message: 'Price should be greater than zero.' });
        return;
      }

      const imagePaths = uploadedImageFiles.map((file) => `/api/uploads/${file.filename}`);

      const newProduct = await Product.create({
        id: generateProductId(name),
        name: String(name).trim(),
        brand: String(brand).trim(),
        category: String(category).trim(),
        price: normalizedPrice,
        oldPrice: toNumber(oldPrice, normalizedPrice),
        rating: toNumber(rating, 4.5),
        stock: toNumber(stock, 0),
        isFeatured: toBoolean(isFeatured),
        shortDescription: String(shortDescription).trim(),
        image: imagePaths[0],
        images: imagePaths,
        specs: {
          cpu: String(cpu || 'N/A').trim(),
          ram: String(ram || 'N/A').trim(),
          storage: String(storage || 'N/A').trim(),
          display: String(display || 'N/A').trim(),
          gpu: String(gpu || 'N/A').trim(),
          warranty: String(warranty || '1 Year').trim(),
        },
      });

      response.status(201).json({
        message: 'Product created successfully.',
        product: normalizeProductDocument(newProduct),
      });
    } catch (error) {
      await removeUploadedFiles(extractUploadedImageFiles(request));
      next(error);
    }
  }
);

app.put(
  '/api/admin/products/:id',
  requireOwnerAuth,
  productUploadMiddleware,
  async (request, response, next) => {
    try {
      const uploadedImageFiles = extractUploadedImageFiles(request);
      const existingProduct = await Product.findOne({ id: request.params.id }).lean();

      if (!existingProduct) {
        await removeUploadedFiles(uploadedImageFiles);
        response.status(404).json({ message: 'Product not found.' });
        return;
      }

      const normalizedExisting = normalizeProductImages(existingProduct);
      const {
        name,
        brand,
        category,
        price,
        oldPrice,
        rating,
        stock,
        isFeatured,
        shortDescription,
        cpu,
        ram,
        storage,
        display,
        gpu,
        warranty,
      } = request.body;

      const normalizedName = String(name || normalizedExisting.name).trim();
      const normalizedBrand = String(brand || normalizedExisting.brand).trim();
      const normalizedCategory = String(category || normalizedExisting.category).trim();
      const normalizedShortDescription = String(
        shortDescription || normalizedExisting.shortDescription
      ).trim();
      const normalizedPrice = toNumber(price, normalizedExisting.price);

      if (
        !normalizedName ||
        !normalizedBrand ||
        !normalizedCategory ||
        !normalizedShortDescription
      ) {
        await removeUploadedFiles(uploadedImageFiles);
        response.status(400).json({ message: 'Missing required product fields.' });
        return;
      }

      if (normalizedPrice <= 0) {
        await removeUploadedFiles(uploadedImageFiles);
        response.status(400).json({ message: 'Price should be greater than zero.' });
        return;
      }

      const nextImages =
        uploadedImageFiles.length > 0
          ? uploadedImageFiles.map((file) => `/api/uploads/${file.filename}`)
          : normalizedExisting.images;

      const updatedProduct = await Product.findOneAndUpdate(
        { id: request.params.id },
        {
          name: normalizedName,
          brand: normalizedBrand,
          category: normalizedCategory,
          price: normalizedPrice,
          oldPrice: toNumber(oldPrice, normalizedExisting.oldPrice || normalizedPrice),
          rating: toNumber(rating, normalizedExisting.rating || 4.5),
          stock: toNumber(stock, normalizedExisting.stock || 0),
          isFeatured:
            isFeatured === undefined
              ? normalizedExisting.isFeatured
              : toBoolean(isFeatured),
          shortDescription: normalizedShortDescription,
          image: nextImages[0] || '',
          images: nextImages,
          specs: {
            cpu: String(cpu || normalizedExisting.specs?.cpu || 'N/A').trim(),
            ram: String(ram || normalizedExisting.specs?.ram || 'N/A').trim(),
            storage: String(storage || normalizedExisting.specs?.storage || 'N/A').trim(),
            display: String(display || normalizedExisting.specs?.display || 'N/A').trim(),
            gpu: String(gpu || normalizedExisting.specs?.gpu || 'N/A').trim(),
            warranty: String(
              warranty || normalizedExisting.specs?.warranty || '1 Year'
            ).trim(),
          },
        },
        { new: true, lean: true }
      );

      if (uploadedImageFiles.length > 0) {
        await Promise.all(
          normalizedExisting.images.map((imagePath) => removeUploadedImageByPath(imagePath))
        );
      }

      response.json({
        message: 'Product updated successfully.',
        product: normalizeProductImages(updatedProduct),
      });
    } catch (error) {
      await removeUploadedFiles(extractUploadedImageFiles(request));
      next(error);
    }
  }
);

app.delete('/api/admin/products/:id', requireOwnerAuth, async (request, response, next) => {
  try {
    const deletedProduct = await Product.findOneAndDelete({ id: request.params.id }).lean();
    if (!deletedProduct) {
      response.status(404).json({ message: 'Product not found.' });
      return;
    }

    const normalizedDeletedProduct = normalizeProductImages(deletedProduct);
    await Promise.all(
      normalizedDeletedProduct.images.map((imagePath) => removeUploadedImageByPath(imagePath))
    );

    response.json({
      message: 'Product deleted successfully.',
      productId: deletedProduct.id,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/products', requireOwnerAuth, async (_request, response, next) => {
  try {
    const products = (await Product.find({}).sort({ createdAt: -1 }).lean()).map(
      normalizeProductImages
    );
    response.json(products);
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/orders', requireOwnerAuth, async (_request, response, next) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean();
    response.json(orders);
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (request, response, next) => {
  try {
    const { customerName, email, phone, city, address, items } = request.body;

    if (!customerName || !email || !phone || !city || !address) {
      response.status(400).json({
        message: 'Missing customer information.',
      });
      return;
    }

    if (!Array.isArray(items) || items.length === 0) {
      response.status(400).json({
        message: 'Order should contain at least one item.',
      });
      return;
    }

    const requestedProductIds = items.map((item) => item.productId);
    const products = await Product.find({ id: { $in: requestedProductIds } }).lean();
    const indexedProducts = new Map(products.map((product) => [product.id, product]));

    const normalizedItems = items
      .map((item) => {
        const quantity = Number(item.quantity);
        const product = indexedProducts.get(item.productId);

        if (!product || Number.isNaN(quantity) || quantity <= 0) {
          return null;
        }

        return {
          productId: product.id,
          name: product.name,
          quantity,
          unitPrice: product.price,
          lineTotal: Number((product.price * quantity).toFixed(2)),
        };
      })
      .filter(Boolean);

    if (normalizedItems.length === 0) {
      response.status(400).json({
        message: 'Invalid order items.',
      });
      return;
    }

    const subtotal = normalizedItems.reduce(
      (total, item) => total + item.lineTotal,
      0
    );
    const shippingCost = subtotal >= 50000 ? 0 : 350;
    const total = Number((subtotal + shippingCost).toFixed(2));

    const order = await Order.create({
      id: `ESG-${Date.now()}`,
      customerName,
      email,
      phone,
      city,
      address,
      items: normalizedItems,
      subtotal: Number(subtotal.toFixed(2)),
      shippingCost,
      total,
    });

    response.status(201).json({
      message: 'Order submitted successfully.',
      order,
    });
  } catch (error) {
    next(error);
  }
});

app.use('/api', (_request, response) => {
  response.status(404).json({ message: 'API route not found.' });
});

if (SERVE_FRONTEND) {
  app.use(
    express.static(FRONTEND_DIST_DIR, {
      index: false,
      maxAge: IS_PRODUCTION ? '7d' : 0,
    })
  );

  app.get(/^\/(?!api(?:\/|$)).*/, (_request, response, next) => {
    if (!frontendBuildExists) {
      response.status(503).send('Frontend build not found. Run: npm run build:prod');
      return;
    }

    response.sendFile(FRONTEND_INDEX_FILE, (error) => {
      if (error) {
        next(error);
      }
    });
  });
}

app.use((error, _request, response, _next) => {
  if (error?.message === 'CORS_NOT_ALLOWED') {
    response.status(403).json({ message: 'Origin is not allowed by CORS policy.' });
    return;
  }

  if (error instanceof multer.MulterError) {
    response.status(400).json({ message: error.message || 'Upload error.' });
    return;
  }

  console.error(error);
  response.status(500).json({ message: 'Unexpected server error.' });
});

Promise.all([ensureUploadsDirectory(), ensureFrontendBuild()])
  .then(async ([, hasFrontendBuild]) => {
    frontendBuildExists = hasFrontendBuild;
    await connectMongo();
    await seedCollectionFromLegacyJson();

    if (IS_PRODUCTION && OWNER_JWT_SECRET === 'please-change-owner-jwt-secret-in-production') {
      console.warn(
        '[WARN] OWNER_JWT_SECRET is using default value. Set a secure secret in production.'
      );
    }

    if (SERVE_FRONTEND && !frontendBuildExists) {
      console.warn(
        `[WARN] Frontend build not found at ${FRONTEND_INDEX_FILE}. Run "npm run build:prod".`
      );
    }

    console.log(`[BOOT] Environment: ${NODE_ENV}`);
    console.log(`[BOOT] MongoDB: ${MONGODB_URI}`);
    console.log(`[BOOT] Uploads directory: ${UPLOADS_DIR}`);
    console.log(`[BOOT] Serve frontend: ${SERVE_FRONTEND ? 'enabled' : 'disabled'}`);
    console.log(
      `[BOOT] CORS origins: ${corsOrigins.length > 0 ? corsOrigins.join(', ') : 'allow-all'}`
    );

    app.listen(PORT, () => {
      console.log(`[READY] El-Sakka API is running on port ${PORT}`);
      console.log(`[READY] Owner username: ${OWNER_USERNAME}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
