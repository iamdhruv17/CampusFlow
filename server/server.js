require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { configureCloudinary } = require('./config/cloudinary');

const PORT = process.env.PORT || 5000;

const validateProductionEnvironment = () => {
  if (process.env.NODE_ENV !== 'production') return;

  const required = ['JWT_SECRET', 'MONGODB_URI', 'FRONTEND_URL'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters in production.');
  }
  if (/^https?:\/\/localhost(?::\d+)?$/i.test(process.env.FRONTEND_URL)) {
    throw new Error('FRONTEND_URL must not point to localhost in production.');
  }
};

const startServer = async () => {
  validateProductionEnvironment();
  // Validate Cloudinary credentials at startup — fail fast if misconfigured
  // (only called when real credentials are provided; logs a warning otherwise)
  const { isCloudinaryConfigured, configureCloudinary } = require('./config/cloudinary');
  if (isCloudinaryConfigured()) {
    configureCloudinary();
  } else {
    console.warn('[Cloudinary] WARNING: Credentials not configured. File uploads will be unavailable.');
    console.warn('[Cloudinary] Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in server/.env');
  }
  await connectDB();
  app.listen(PORT, () => {
    console.log(`CampusFlow server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
