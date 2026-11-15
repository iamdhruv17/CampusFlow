/**
 * Cloudinary Configuration
 *
 * Initializes and exports the official Cloudinary v2 SDK instance.
 * Credentials are loaded exclusively from server-side environment variables.
 * The API secret is NEVER exposed to the frontend or logged.
 */

const cloudinary = require('cloudinary').v2;

/**
 * Configure Cloudinary using server environment variables.
 * Called once at application startup (from server.js or the first import).
 * Throws a clear error if any required credential is missing.
 */
const configureCloudinary = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

  const missing = [];
  if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    throw new Error(
      `[Cloudinary] Missing required environment variable(s): ${missing.join(', ')}. ` +
      'Set these in server/.env before starting the application.'
    );
  }

  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true, // Always use HTTPS
  });

  console.log(`[Cloudinary] Configured for cloud: ${CLOUDINARY_CLOUD_NAME}`);
};

/**
 * Checks whether Cloudinary has been configured with real (non-placeholder) credentials.
 * Returns true if credentials are present and are not the example placeholder values.
 */
const isCloudinaryConfigured = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  const placeholders = ['your_cloud_name', 'your_api_key', 'your_api_secret', '', undefined];
  return (
    !placeholders.includes(CLOUDINARY_CLOUD_NAME) &&
    !placeholders.includes(CLOUDINARY_API_KEY) &&
    !placeholders.includes(CLOUDINARY_API_SECRET)
  );
};

module.exports = { cloudinary, configureCloudinary, isCloudinaryConfigured };
