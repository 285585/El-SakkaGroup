const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');
const multer = require('multer');
const crypto = require('crypto');
const dotenv = require('dotenv');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { OAuth2Client } = require('google-auth-library');
const Product = require('./models/product.model');
const Order = require('./models/order.model');
const User = require('./models/user.model');
const PaymentCard = require('./models/payment-card.model');
const Cart = require('./models/cart.model');

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
const DEFAULT_PRODUCT_IMAGE = '/assets/images/laptop-placeholder.svg';
const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = String(process.env.GOOGLE_CLIENT_SECRET || '').trim();
const GOOGLE_REDIRECT_URI =
  String(process.env.GOOGLE_REDIRECT_URI || '').trim() ||
  `http://localhost:${PORT}/api/auth/google/callback`;
const FRONTEND_LOGIN_URL =
  String(process.env.FRONTEND_LOGIN_URL || '').trim() || 'http://localhost:4200/login';

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i;
const USERNAME_REGEX = /^[a-z0-9._-]{3,30}$/i;
const CARD_BRAND_PATTERNS = [
  { brand: 'visa', regex: /^4\d{12}(\d{3})?(\d{3})?$/ },
  { brand: 'mastercard', regex: /^(5[1-5]\d{14}|2(2[2-9]|[3-6]\d|7[01])\d{12}|2720\d{12})$/ },
  { brand: 'amex', regex: /^3[47]\d{13}$/ },
  { brand: 'meeza', regex: /^5078\d{12}$/ },
];
const corsOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

let frontendBuildExists = false;
const hasGoogleAuthConfig = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
const googleOAuthClient = hasGoogleAuthConfig
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)
  : null;

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

const createAuthToken = (payload) =>
  jwt.sign(payload, OWNER_JWT_SECRET, {
    expiresIn: OWNER_TOKEN_TTL,
  });

const createGoogleSetupToken = (payload) =>
  jwt.sign(
    {
      purpose: 'google-setup',
      ...payload,
    },
    OWNER_JWT_SECRET,
    {
      expiresIn: '20m',
    }
  );

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

const normalizeUsername = (value) => String(value || '').trim().toLowerCase();
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const getSuggestedUsernameFromEmail = (email) => {
  const localPart = String(email || '')
    .split('@')[0]
    .replace(/[^a-z0-9._-]/gi, '')
    .toLowerCase();
  return localPart || `user${Date.now().toString(36)}`;
};

const buildFrontendLoginRedirect = (params = {}) => {
  const url = new URL(FRONTEND_LOGIN_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      url.searchParams.set(key, String(value));
    }
  });
  return url.toString();
};

const formatSessionUser = (user) => ({
  username: user.username,
  role: user.role,
  ...(user.email ? { email: user.email } : {}),
  ...(user.firstName ? { firstName: user.firstName } : {}),
  ...(user.lastName ? { lastName: user.lastName } : {}),
  ...(user.phone ? { phone: user.phone } : {}),
});

const requireAuth = (request, response, next) => {
  const token = getTokenFromRequest(request);

  if (!token) {
    response.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const payload = jwt.verify(token, OWNER_JWT_SECRET);
    request.authUser = {
      userId: payload.userId,
      username: payload.username,
      role: payload.role,
      email: payload.email,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
    };
    next();
  } catch {
    response.status(401).json({ message: 'Unauthorized.' });
  }
};

const requireOwnerAuth = (request, response, next) => {
  requireAuth(request, response, () => {
    if (request.authUser?.role !== 'owner') {
      response.status(403).json({ message: 'Only owner can access this route.' });
      return;
    }

    next();
  });
};

const normalizeCardNumber = (value) => String(value || '').replace(/\s+/g, '');
const normalizePaymentMethod = (value) => normalizeText(value).replace(/\s+/g, '_');
const resolvePaymentMethod = (value) =>
  normalizePaymentMethod(value) === 'card' ? 'card' : 'cash_on_delivery';

const detectCardBrand = (cardNumber) => {
  for (const matcher of CARD_BRAND_PATTERNS) {
    if (matcher.regex.test(cardNumber)) {
      return matcher.brand;
    }
  }

  return 'card';
};

const maskCard = (cardNumber) => {
  const last4 = cardNumber.slice(-4);
  return {
    last4,
    masked: `**** **** **** ${last4}`,
  };
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
  const safeImages = images.length > 0 ? images : [DEFAULT_PRODUCT_IMAGE];
  return {
    ...product,
    image: safeImages[0],
    images: safeImages,
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
  const inStockOnly = toBoolean(query.inStock);

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

  if (inStockOnly) {
    filtered = filtered.filter((product) => Number(product.stock) > 0);
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
        orderedByUsername: String(order.orderedByUsername || 'legacy-customer').trim(),
        orderedByRole: String(order.orderedByRole || 'customer').trim() === 'owner' ? 'owner' : 'customer',
        customerName: String(order.customerName || '').trim(),
        email: String(order.email || '').trim(),
        phone: String(order.phone || '').trim(),
        shippingAddress: {
          city: String(order.shippingAddress?.city || order.city || '').trim(),
          area: String(order.shippingAddress?.area || '').trim(),
          addressLine1: String(order.shippingAddress?.addressLine1 || order.address || '').trim(),
          addressLine2: String(order.shippingAddress?.addressLine2 || '').trim(),
          buildingNo: String(order.shippingAddress?.buildingNo || '').trim(),
          floorNo: String(order.shippingAddress?.floorNo || '').trim(),
          apartmentNo: String(order.shippingAddress?.apartmentNo || '').trim(),
          landmark: String(order.shippingAddress?.landmark || '').trim(),
          postalCode: String(order.shippingAddress?.postalCode || '').trim(),
          notes: String(order.shippingAddress?.notes || '').trim(),
        },
        payment: {
          method: resolvePaymentMethod(order.payment?.method || 'cash_on_delivery'),
          cardBrand: String(order.payment?.cardBrand || '').trim(),
          cardLast4: String(order.payment?.cardLast4 || '').trim(),
          cardHolderName: String(order.payment?.cardHolderName || '').trim(),
          cardExpiry: String(order.payment?.cardExpiry || '').trim(),
        },
        status: ['pending', 'confirmed', 'shipped', 'delivered', 'returned'].includes(
          String(order.status || '').trim()
        )
          ? String(order.status).trim()
          : 'pending',
        statusUpdatedAt: order.statusUpdatedAt || order.createdAt || undefined,
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

app.get('/api/auth/google/start', (request, response) => {
  if (!hasGoogleAuthConfig || !googleOAuthClient) {
    response.redirect(
      buildFrontendLoginRedirect({
        google: 'config-missing',
      })
    );
    return;
  }

  const stateToken = jwt.sign(
    {
      purpose: 'google-oauth-state',
      nonce: crypto.randomUUID(),
      ip: request.ip,
    },
    OWNER_JWT_SECRET,
    { expiresIn: '15m' }
  );

  const authUrl = googleOAuthClient.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state: stateToken,
  });

  response.redirect(authUrl);
});

app.get('/api/auth/google/callback', async (request, response) => {
  const redirectWithParams = (params) => response.redirect(buildFrontendLoginRedirect(params));

  if (!hasGoogleAuthConfig || !googleOAuthClient) {
    redirectWithParams({
      google: 'config-missing',
    });
    return;
  }

  const { code, state } = request.query || {};
  if (!code || !state) {
    redirectWithParams({ google: 'invalid-callback' });
    return;
  }

  try {
    const decodedState = jwt.verify(String(state), OWNER_JWT_SECRET);
    if (decodedState?.purpose !== 'google-oauth-state') {
      redirectWithParams({ google: 'invalid-state' });
      return;
    }

    const { tokens } = await googleOAuthClient.getToken(String(code));
    if (!tokens?.id_token) {
      redirectWithParams({ google: 'missing-id-token' });
      return;
    }

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: tokens.id_token,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const normalizedEmail = normalizeEmail(payload?.email);
    const googleSub = String(payload?.sub || '').trim();

    if (!payload?.email_verified || !normalizedEmail || !GMAIL_REGEX.test(normalizedEmail) || !googleSub) {
      redirectWithParams({ google: 'unverified-email' });
      return;
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.username && existingUser.passwordHash) {
      redirectWithParams({
        google: 'existing-account',
        email: normalizedEmail,
      });
      return;
    }

    const setupToken = createGoogleSetupToken({
      email: normalizedEmail,
      googleSub,
      userId: existingUser?._id?.toString() || '',
    });

    redirectWithParams({
      google: 'setup-required',
      setupToken,
      email: normalizedEmail,
      suggestedUsername: getSuggestedUsernameFromEmail(normalizedEmail),
    });
  } catch (error) {
    console.error('Google callback error:', error);
    redirectWithParams({
      google: 'callback-error',
    });
  }
});

app.post('/api/auth/google/complete-signup', async (request, response, next) => {
  try {
    const { setupToken, username, password } = request.body || {};
    const normalizedUsername = normalizeUsername(username);

    if (!setupToken || !normalizedUsername || !password) {
      response
        .status(400)
        .json({ message: 'Setup token, username and password are required.' });
      return;
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      response.status(400).json({
        message: 'Username must be 3-30 chars and contain letters, numbers, dot, underscore or dash.',
      });
      return;
    }

    if (String(password).length < 6) {
      response.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    if (normalizedUsername === normalizeUsername(OWNER_USERNAME)) {
      response.status(400).json({ message: 'This username is reserved.' });
      return;
    }

    let decodedSetupToken;
    try {
      decodedSetupToken = jwt.verify(String(setupToken), OWNER_JWT_SECRET);
    } catch {
      response.status(401).json({ message: 'Google activation session expired. Please try again.' });
      return;
    }

    if (decodedSetupToken?.purpose !== 'google-setup') {
      response.status(401).json({ message: 'Invalid Google activation session.' });
      return;
    }

    const normalizedEmail = normalizeEmail(decodedSetupToken.email);
    const googleSub = String(decodedSetupToken.googleSub || '').trim();
    const setupUserId = String(decodedSetupToken.userId || '').trim();

    if (!normalizedEmail || !googleSub) {
      response.status(401).json({ message: 'Invalid Google activation data.' });
      return;
    }

    const userByUsername = await User.findOne({ username: normalizedUsername });
    if (userByUsername && (!setupUserId || userByUsername._id.toString() !== setupUserId)) {
      response.status(409).json({ message: 'Username already exists.' });
      return;
    }

    let existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser && existingUser.username && existingUser.passwordHash) {
      response.status(409).json({
        message: 'This Gmail is already activated. Use username and password to login.',
      });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    if (existingUser) {
      existingUser.username = normalizedUsername;
      existingUser.passwordHash = passwordHash;
      existingUser.googleSub = googleSub;
      existingUser.isEmailVerified = true;
      await existingUser.save();
    } else {
      existingUser = await User.create({
        email: normalizedEmail,
        username: normalizedUsername,
        passwordHash,
        googleSub,
        isEmailVerified: true,
      });
    }

    const token = createAuthToken({
      userId: existingUser._id.toString(),
      username: existingUser.username,
      email: existingUser.email,
      role: 'customer',
    });

    response.status(201).json({
      message: 'Google activation completed successfully.',
      token,
      user: formatSessionUser({
        username: existingUser.username,
        email: existingUser.email,
        role: 'customer',
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  try {
    const { firstName, lastName, phone, email, username, password } = request.body || {};
    const normalizedFirstName = String(firstName || '').trim();
    const normalizedLastName = String(lastName || '').trim();
    const normalizedPhone = String(phone || '').trim();
    const normalizedEmail = normalizeEmail(email);
    const normalizedUsername = normalizeUsername(username);

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedPhone ||
      !normalizedEmail ||
      !normalizedUsername ||
      !password
    ) {
      response.status(400).json({
        message: 'First name, last name, phone, email, username and password are required.',
      });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      response.status(400).json({ message: 'Invalid email format.' });
      return;
    }

    if (!USERNAME_REGEX.test(normalizedUsername)) {
      response.status(400).json({
        message: 'Username must be 3-30 chars and contain letters, numbers, dot, underscore or dash.',
      });
      return;
    }

    if (String(password).length < 6) {
      response.status(400).json({ message: 'Password must be at least 6 characters.' });
      return;
    }

    if (normalizedUsername === normalizeUsername(OWNER_USERNAME)) {
      response.status(400).json({ message: 'This username is reserved.' });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }],
    }).lean();

    if (existingUser) {
      response.status(409).json({ message: 'Email or username already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const createdUser = await User.create({
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      phone: normalizedPhone,
      email: normalizedEmail,
      username: normalizedUsername,
      passwordHash,
      isEmailVerified: true,
    });

    const token = createAuthToken({
      userId: createdUser._id.toString(),
      username: createdUser.username,
      email: createdUser.email,
      firstName: createdUser.firstName,
      lastName: createdUser.lastName,
      phone: createdUser.phone,
      role: 'customer',
    });

    response.status(201).json({
      message: 'Registration successful.',
      token,
      user: formatSessionUser({
        firstName: createdUser.firstName,
        lastName: createdUser.lastName,
        phone: createdUser.phone,
        username: createdUser.username,
        email: createdUser.email,
        role: 'customer',
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  try {
    const { username, password } = request.body || {};
    const normalizedUsername = normalizeUsername(username);

    if (!normalizedUsername || !password) {
      response.status(400).json({ message: 'Username and password are required.' });
      return;
    }

    if (
      normalizedUsername === normalizeUsername(OWNER_USERNAME) &&
      String(password) === OWNER_PASSWORD
    ) {
      const ownerToken = createAuthToken({
        username: normalizeUsername(OWNER_USERNAME),
        role: 'owner',
      });

      response.json({
        token: ownerToken,
        user: formatSessionUser({
          username: normalizeUsername(OWNER_USERNAME),
          role: 'owner',
        }),
      });
      return;
    }

    const user = await User.findOne({ username: normalizedUsername });
    if (!user) {
      response.status(401).json({ message: 'Invalid username or password.' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(String(password), user.passwordHash);
    if (!isPasswordValid) {
      response.status(401).json({ message: 'Invalid username or password.' });
      return;
    }

    const token = createAuthToken({
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: 'customer',
    });

    response.json({
      token,
      user: formatSessionUser({
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        username: user.username,
        email: user.email,
        role: 'customer',
      }),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/auth/session', (request, response) => {
  const token = getTokenFromRequest(request);

  if (!token) {
    response.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  try {
    const payload = jwt.verify(token, OWNER_JWT_SECRET);
    response.json({
      user: formatSessionUser({
        username: payload.username,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        phone: payload.phone,
        role: payload.role,
      }),
    });
  } catch {
    response.status(401).json({ message: 'Unauthorized.' });
  }
});

app.get('/api/user/cart', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner' || !request.authUser.userId) {
      response.json({ items: [] });
      return;
    }

    const cart = await Cart.findOne({ userId: request.authUser.userId }).lean();
    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      response.json({ items: [] });
      return;
    }

    const productIds = cart.items.map((item) => item.productId);
    const products = (await Product.find({ id: { $in: productIds } }).lean()).map(
      normalizeProductImages
    );
    const productsMap = new Map(products.map((product) => [product.id, product]));

    const items = cart.items
      .map((item) => {
        const product = productsMap.get(item.productId);
        if (!product) {
          return null;
        }

        return {
          product,
          quantity: Number(item.quantity),
        };
      })
      .filter(Boolean);

    response.json({
      items,
    });
  } catch (error) {
    next(error);
  }
});

app.put('/api/user/cart', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner' || !request.authUser.userId) {
      response.status(403).json({ message: 'Owner account cannot use user cart API.' });
      return;
    }

    const rawItems = Array.isArray(request.body?.items) ? request.body.items : [];
    if (rawItems.length === 0) {
      await Cart.findOneAndUpdate(
        { userId: request.authUser.userId },
        { items: [] },
        { upsert: true, new: true }
      );
      response.json({ message: 'Cart updated successfully.', items: [] });
      return;
    }

    const normalizedItems = rawItems
      .map((item) => ({
        productId: String(item?.productId || '').trim(),
        quantity: Number(item?.quantity),
      }))
      .filter((item) => item.productId && Number.isInteger(item.quantity) && item.quantity > 0);

    if (normalizedItems.length !== rawItems.length) {
      response.status(400).json({ message: 'Invalid cart items.' });
      return;
    }

    const products = await Product.find({
      id: { $in: normalizedItems.map((item) => item.productId) },
    })
      .select({ id: 1 })
      .lean();
    const validProductIds = new Set(products.map((product) => product.id));
    const hasInvalidProduct = normalizedItems.some((item) => !validProductIds.has(item.productId));
    if (hasInvalidProduct) {
      response.status(400).json({ message: 'Cart contains invalid products.' });
      return;
    }

    await Cart.findOneAndUpdate(
      { userId: request.authUser.userId },
      {
        items: normalizedItems,
      },
      {
        upsert: true,
      }
    );

    response.json({
      message: 'Cart updated successfully.',
      items: normalizedItems,
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/user/cards', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner') {
      response.json([]);
      return;
    }

    const cards = await PaymentCard.find({ userId: request.authUser.userId })
      .sort({ createdAt: -1 })
      .lean();

    response.json(
      cards.map((card) => ({
        id: card.tokenId,
        cardHolderName: card.cardHolderName,
        brand: card.brand,
        last4: card.last4,
        expiryMonth: card.expiryMonth,
        expiryYear: card.expiryYear,
      }))
    );
  } catch (error) {
    next(error);
  }
});

app.post('/api/user/cards', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner') {
      response.status(403).json({ message: 'Owner account cannot save cards.' });
      return;
    }

    const { cardHolderName, cardNumber, expiryMonth, expiryYear } = request.body || {};
    const normalizedCardNumber = normalizeCardNumber(cardNumber);
    const normalizedHolderName = String(cardHolderName || '').trim();
    const month = Number(expiryMonth);
    const year = Number(expiryYear);

    if (!normalizedHolderName || !normalizedCardNumber || !month || !year) {
      response.status(400).json({ message: 'Missing card details.' });
      return;
    }

    if (!/^\d{13,19}$/.test(normalizedCardNumber)) {
      response.status(400).json({ message: 'Invalid card number.' });
      return;
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      response.status(400).json({ message: 'Invalid expiry month.' });
      return;
    }

    if (!Number.isInteger(year) || year < new Date().getFullYear()) {
      response.status(400).json({ message: 'Invalid expiry year.' });
      return;
    }

    const { last4 } = maskCard(normalizedCardNumber);
    const brand = detectCardBrand(normalizedCardNumber);
    const tokenId = `card_${crypto.randomUUID()}`;

    const createdCard = await PaymentCard.create({
      userId: request.authUser.userId,
      cardHolderName: normalizedHolderName,
      brand,
      last4,
      expiryMonth: month,
      expiryYear: year,
      tokenId,
    });

    response.status(201).json({
      message: 'Card saved successfully.',
      card: {
        id: createdCard.tokenId,
        cardHolderName: createdCard.cardHolderName,
        brand: createdCard.brand,
        last4: createdCard.last4,
        expiryMonth: createdCard.expiryMonth,
        expiryYear: createdCard.expiryYear,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/user/cards/:id', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner') {
      response.status(403).json({ message: 'Owner account cannot delete cards.' });
      return;
    }

    const deletedCard = await PaymentCard.findOneAndDelete({
      tokenId: request.params.id,
      userId: request.authUser.userId,
    }).lean();

    if (!deletedCard) {
      response.status(404).json({ message: 'Card not found.' });
      return;
    }

    response.json({ message: 'Card deleted successfully.', cardId: deletedCard.tokenId });
  } catch (error) {
    next(error);
  }
});

app.put('/api/user/cards/:id', requireAuth, async (request, response, next) => {
  try {
    if (request.authUser.role === 'owner') {
      response.status(403).json({ message: 'Owner account cannot update cards.' });
      return;
    }

    const { cardHolderName, cardNumber, expiryMonth, expiryYear } = request.body || {};
    const normalizedCardNumber = normalizeCardNumber(cardNumber);
    const normalizedHolderName = String(cardHolderName || '').trim();
    const month = Number(expiryMonth);
    const year = Number(expiryYear);

    if (!normalizedHolderName || !normalizedCardNumber || !month || !year) {
      response.status(400).json({ message: 'Missing card details.' });
      return;
    }

    if (!/^\d{13,19}$/.test(normalizedCardNumber)) {
      response.status(400).json({ message: 'Invalid card number.' });
      return;
    }

    if (!Number.isInteger(month) || month < 1 || month > 12) {
      response.status(400).json({ message: 'Invalid expiry month.' });
      return;
    }

    if (!Number.isInteger(year) || year < new Date().getFullYear()) {
      response.status(400).json({ message: 'Invalid expiry year.' });
      return;
    }

    const { last4 } = maskCard(normalizedCardNumber);
    const brand = detectCardBrand(normalizedCardNumber);

    const updatedCard = await PaymentCard.findOneAndUpdate(
      {
        tokenId: request.params.id,
        userId: request.authUser.userId,
      },
      {
        cardHolderName: normalizedHolderName,
        brand,
        last4,
        expiryMonth: month,
        expiryYear: year,
      },
      { new: true, lean: true }
    );

    if (!updatedCard) {
      response.status(404).json({ message: 'Card not found.' });
      return;
    }

    response.json({
      message: 'Card updated successfully.',
      card: {
        id: updatedCard.tokenId,
        cardHolderName: updatedCard.cardHolderName,
        brand: updatedCard.brand,
        last4: updatedCard.last4,
        expiryMonth: updatedCard.expiryMonth,
        expiryYear: updatedCard.expiryYear,
      },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/user/orders', requireAuth, async (request, response, next) => {
  try {
    const query =
      request.authUser.role === 'owner'
        ? { orderedByRole: 'owner', orderedByUsername: request.authUser.username }
        : { userId: request.authUser.userId };
    const orders = await Order.find(query).sort({ createdAt: -1 }).lean();
    response.json(orders);
  } catch (error) {
    next(error);
  }
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

app.get('/api/admin/users', requireOwnerAuth, async (_request, response, next) => {
  try {
    const users = await User.find({})
      .sort({ createdAt: -1 })
      .select({
        firstName: 1,
        lastName: 1,
        phone: 1,
        email: 1,
        username: 1,
        createdAt: 1,
      })
      .lean();

    response.json(
      users.map((user) => ({
        id: user._id.toString(),
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        phone: user.phone || '',
        email: user.email || '',
        username: user.username || '',
        createdAt: user.createdAt,
      }))
    );
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

app.put('/api/admin/orders/:id/status', requireOwnerAuth, async (request, response, next) => {
  try {
    const status = String(request.body?.status || '').trim();
    const allowedStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'returned'];

    if (!allowedStatuses.includes(status)) {
      response.status(400).json({ message: 'Invalid status.' });
      return;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      { id: request.params.id },
      {
        status,
        statusUpdatedAt: new Date(),
      },
      { new: true, lean: true }
    );

    if (!updatedOrder) {
      response.status(404).json({ message: 'Order not found.' });
      return;
    }

    response.json({
      message: 'Order status updated successfully.',
      order: updatedOrder,
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', requireAuth, async (request, response, next) => {
  try {
    const {
      customerName,
      email,
      phone,
      city,
      area,
      addressLine1,
      addressLine2,
      buildingNo,
      floorNo,
      apartmentNo,
      landmark,
      postalCode,
      notes,
      paymentMethod,
      savedCardId,
      saveCard,
      cardHolderName,
      cardNumber,
      cardExpiryMonth,
      cardExpiryYear,
      cardCvv,
      items,
    } = request.body;

    if (!customerName || !email || !phone || !city || !addressLine1) {
      response.status(400).json({
        message: 'Missing customer shipping details.',
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
    const method = resolvePaymentMethod(paymentMethod);

    let paymentSnapshot = {
      method,
      cardBrand: '',
      cardLast4: '',
      cardHolderName: '',
      cardExpiry: '',
    };

    if (method === 'card') {
      if (savedCardId) {
        const savedCard = await PaymentCard.findOne({
          tokenId: String(savedCardId),
          userId: request.authUser.userId,
        }).lean();

        if (!savedCard) {
          response.status(400).json({ message: 'Saved card not found.' });
          return;
        }

        paymentSnapshot = {
          method: 'card',
          cardBrand: savedCard.brand,
          cardLast4: savedCard.last4,
          cardHolderName: savedCard.cardHolderName,
          cardExpiry: `${String(savedCard.expiryMonth).padStart(2, '0')}/${savedCard.expiryYear}`,
        };
      } else {
        const normalizedCardNumber = normalizeCardNumber(cardNumber);
        const normalizedHolderName = String(cardHolderName || '').trim();
        const expiryMonth = Number(cardExpiryMonth);
        const expiryYear = Number(cardExpiryYear);
        const normalizedCvv = String(cardCvv || '').trim();

        if (
          !normalizedHolderName ||
          !normalizedCardNumber ||
          !expiryMonth ||
          !expiryYear ||
          !normalizedCvv
        ) {
          response.status(400).json({ message: 'Missing card details.' });
          return;
        }

        if (!/^\d{13,19}$/.test(normalizedCardNumber)) {
          response.status(400).json({ message: 'Invalid card number.' });
          return;
        }

        if (!/^\d{3,4}$/.test(normalizedCvv)) {
          response.status(400).json({ message: 'Invalid CVV.' });
          return;
        }

        if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) {
          response.status(400).json({ message: 'Invalid card expiry month.' });
          return;
        }

        if (!Number.isInteger(expiryYear) || expiryYear < new Date().getFullYear()) {
          response.status(400).json({ message: 'Invalid card expiry year.' });
          return;
        }

        const { last4 } = maskCard(normalizedCardNumber);
        const brand = detectCardBrand(normalizedCardNumber);
        paymentSnapshot = {
          method: 'card',
          cardBrand: brand,
          cardLast4: last4,
          cardHolderName: normalizedHolderName,
          cardExpiry: `${String(expiryMonth).padStart(2, '0')}/${expiryYear}`,
        };

        // Security: never store full card number or CVV in database.
        if (Boolean(saveCard) && request.authUser.role !== 'owner') {
          const existingCard = await PaymentCard.findOne({
            userId: request.authUser.userId,
            last4,
            expiryMonth,
            expiryYear,
            cardHolderName: normalizedHolderName,
          }).lean();

          if (!existingCard) {
            await PaymentCard.create({
              userId: request.authUser.userId,
              cardHolderName: normalizedHolderName,
              brand,
              last4,
              expiryMonth,
              expiryYear,
              tokenId: `card_${crypto.randomUUID()}`,
            });
          }
        }
      }
    }

    const order = await Order.create({
      id: `ESG-${Date.now()}`,
      userId: request.authUser.userId || undefined,
      orderedByUsername: request.authUser.username,
      orderedByRole: request.authUser.role,
      customerName,
      email,
      phone,
      shippingAddress: {
        city: String(city).trim(),
        area: String(area || '').trim(),
        addressLine1: String(addressLine1).trim(),
        addressLine2: String(addressLine2 || '').trim(),
        buildingNo: String(buildingNo || '').trim(),
        floorNo: String(floorNo || '').trim(),
        apartmentNo: String(apartmentNo || '').trim(),
        landmark: String(landmark || '').trim(),
        postalCode: String(postalCode || '').trim(),
        notes: String(notes || '').trim(),
      },
      payment: paymentSnapshot,
      items: normalizedItems,
      status: 'pending',
      statusUpdatedAt: new Date(),
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
