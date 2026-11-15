/**
 * Storage Service — Cloudinary Integration
 *
 * Handles all file upload, download URL generation, and deletion
 * through the official Cloudinary Node.js SDK.
 *
 * Security model:
 * - All files use resource_type: "raw" and type: "authenticated"
 * - No public URLs are generated or stored
 * - Signed download URLs are generated on-demand with a 5-minute expiry
 * - API secret is never sent to the frontend
 * - Uploads use server-side SDK only (upload_stream from Multer buffer)
 */

const { v4: uuidv4 } = require('uuid');
const { Readable } = require('stream');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const FileRecord = require('../models/FileRecord');

const CLOUDINARY_FOLDER = 'campusflow/documents';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

// MIME type → format string used by Cloudinary
const MIME_TO_FORMAT = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
};

const createValidationError = (msg) => {
  const err = new Error(msg);
  err.statusCode = 400;
  return err;
};

// ─────────────────────────────────────────────────────────────────────────────
// File Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validates file buffer signatures (magic numbers), extension, MIME type, and size.
 * Never trusts the browser-provided MIME type alone — cross-checks magic bytes.
 */
const validateFileBuffer = (buffer, originalname, mimetype) => {
  if (!buffer || buffer.length === 0) {
    throw createValidationError('File content is empty.');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw createValidationError('File exceeds the 5 MB size limit.');
  }

  const ext = ('.' + originalname.split('.').pop()).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw createValidationError(
      `Unsupported file extension "${ext}". Allowed: PDF, JPG, PNG.`
    );
  }

  const normalizedMime = mimetype ? mimetype.toLowerCase() : '';
  if (!ALLOWED_MIME_TYPES.includes(normalizedMime)) {
    throw createValidationError(
      `Unsupported MIME type "${mimetype}". Allowed: application/pdf, image/jpeg, image/png.`
    );
  }

  // Magic bytes validation — cannot be spoofed by the browser
  const isPdf =
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46; // %PDF

  const isJpeg =
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff; // FF D8 FF

  const isPng =
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a; // 89 50 4E 47 0D 0A 1A 0A

  if (ext === '.pdf') {
    if (!isPdf || normalizedMime !== 'application/pdf') {
      throw createValidationError(
        'Invalid file content: Signature does not match PDF format.'
      );
    }
  } else if (ext === '.jpg' || ext === '.jpeg') {
    if (!isJpeg || (normalizedMime !== 'image/jpeg' && normalizedMime !== 'image/jpg')) {
      throw createValidationError(
        'Invalid file content: Signature does not match JPEG format.'
      );
    }
  } else if (ext === '.png') {
    if (!isPng || normalizedMime !== 'image/png') {
      throw createValidationError(
        'Invalid file content: Signature does not match PNG format.'
      );
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Upload
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Uploads a Multer memory buffer to Cloudinary using upload_stream.
 * Returns a promise that resolves with the Cloudinary upload result.
 *
 * Uses:
 *   resource_type: "raw"          — preserves original file, works for all formats
 *   type: "authenticated"         — private delivery, no public access
 *   folder: "campusflow/documents"
 *   public_id: UUID               — no user-controlled storage paths
 */
const uploadBufferToCloudinary = (buffer, publicId) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        type: 'authenticated',
        folder: CLOUDINARY_FOLDER,
        public_id: publicId,
        overwrite: false,
        // Do not apply any transformations — store the raw document as-is
        invalidate: false,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    // Push buffer through the stream
    const { Readable } = require('stream');
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    readable.pipe(uploadStream);
  });
};

/**
 * Validates, uploads a file buffer to Cloudinary, and creates a FileRecord.
 *
 * Compensation logic:
 * - If Cloudinary upload succeeds but FileRecord creation fails → delete Cloudinary asset
 * - If Cloudinary upload fails → no FileRecord is created
 * - Either a complete FileRecord exists and the Cloudinary asset is accessible,
 *   or neither exists. Partial states are avoided.
 */
const uploadFile = async ({ buffer, mimetype, originalname, uploaderId, requestId }) => {
  // Step 1: Validate buffer, extension, mime, and magic numbers first
  validateFileBuffer(buffer, originalname, mimetype);

  // Step 2: Ensure Cloudinary credentials are configured
  if (!isCloudinaryConfigured()) {
    const err = new Error('Cloudinary is not configured. Document storage is currently unavailable.');
    err.statusCode = 503;
    throw err;
  }

  const normalizedMime = mimetype.toLowerCase();
  const format = MIME_TO_FORMAT[normalizedMime] || 'bin';
  // Generate a UUID-based public_id — users cannot control storage paths
  const publicId = uuidv4();

  let cloudinaryResult = null;
  let fileRecord = null;

  try {
    // Step 2: Upload to Cloudinary
    cloudinaryResult = await uploadBufferToCloudinary(buffer, publicId);

    // Step 3: Save FileRecord to MongoDB
    fileRecord = await FileRecord.create({
      uploaderId,
      requestId,
      originalName: originalname,
      cloudinaryAssetId: cloudinaryResult.asset_id,
      cloudinaryPublicId: cloudinaryResult.public_id,
      resourceType: cloudinaryResult.resource_type,
      deliveryType: cloudinaryResult.type,
      format: cloudinaryResult.format || format,
      mimeType: normalizedMime,
      fileSize: buffer.length,
    });

    return fileRecord;
  } catch (error) {
    // Compensating cleanup: if Cloudinary upload succeeded but MongoDB save failed,
    // delete the orphaned Cloudinary asset
    if (cloudinaryResult && !fileRecord) {
      try {
        await cloudinary.uploader.destroy(cloudinaryResult.public_id, {
          resource_type: 'raw',
          type: 'authenticated',
        });
      } catch (cleanupErr) {
        // Log so the orphaned asset can be found and cleaned up manually
        console.error(
          `[Storage] CLEANUP FAILED: Cloudinary asset ${cloudinaryResult.public_id} ` +
          `(asset_id: ${cloudinaryResult.asset_id}) is orphaned after MongoDB failure. ` +
          `Error: ${cleanupErr.message}`
        );
      }
    }
    throw error;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Signed Download URL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a time-limited signed download URL for a Cloudinary asset.
 * The URL expires in SIGNED_URL_EXPIRY_SECONDS (5 minutes).
 *
 * This is generated on the backend using the API secret — never on the frontend.
 * The returned URL is a temporary bearer link; the application must perform
 * its own authorization check before calling this function.
 */
const generateSignedDownloadUrl = (fileRecord) => {
  if (!isCloudinaryConfigured()) {
    const err = new Error('Cloudinary is not configured. Cannot generate download link.');
    err.statusCode = 503;
    throw err;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_EXPIRY_SECONDS;

  // private_download_url generates a signed URL for authenticated assets
  const signedUrl = cloudinary.utils.private_download_url(
    fileRecord.cloudinaryPublicId,
    fileRecord.format,
    {
      resource_type: fileRecord.resourceType || 'raw',
      type: fileRecord.deliveryType || 'authenticated',
      expires_at: expiresAt,
      attachment: false, // inline delivery so PDFs open in browser
    }
  );

  return { signedUrl, expiresAt };
};

/**
 * Fetches an authenticated Cloudinary download on the server.
 *
 * private_download_url is intentionally used only as an upstream URL here.
 * Cloudinary's download endpoint may return a generated download filename for
 * raw assets; the preview controller replaces that with safe inline headers.
 */
const fetchAuthenticatedFile = async (fileRecord) => {
  const { signedUrl } = generateSignedDownloadUrl(fileRecord);

  let upstreamResponse;
  try {
    upstreamResponse = await fetch(signedUrl);
  } catch (error) {
    const fetchError = new Error('Unable to retrieve the document from storage.');
    fetchError.statusCode = 502;
    fetchError.cause = error;
    throw fetchError;
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const upstreamError = new Error(
      upstreamResponse.status === 404
        ? 'Document is no longer available in storage.'
        : 'Document storage returned an error.'
    );
    upstreamError.statusCode = upstreamResponse.status === 404 ? 404 : 502;
    throw upstreamError;
  }

  return typeof Readable.fromWeb === 'function' && typeof upstreamResponse.body.getReader === 'function'
    ? Readable.fromWeb(upstreamResponse.body)
    : upstreamResponse.body;
};

// ─────────────────────────────────────────────────────────────────────────────
// Deletion
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deletes a Cloudinary asset and its associated FileRecord.
 *
 * Order of operations:
 * 1. Find FileRecord (no-op if already deleted)
 * 2. Delete from Cloudinary
 * 3. Remove FileRecord from MongoDB only after Cloudinary confirms deletion
 *
 * If Cloudinary deletion fails, the FileRecord is left intact so the asset
 * can be retried for deletion. The error is logged for manual cleanup.
 */
const deleteFileRecord = async (fileRecordId) => {
  const fileRecord = await FileRecord.findById(fileRecordId);
  if (!fileRecord) return;

  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary is not configured. Cannot delete remote asset.');
  }

  try {
    await cloudinary.uploader.destroy(fileRecord.cloudinaryPublicId, {
      resource_type: fileRecord.resourceType || 'raw',
      type: fileRecord.deliveryType || 'authenticated',
      invalidate: true,
    });
  } catch (err) {
    console.error(
      `[Storage] Cloudinary deletion failed for public_id="${fileRecord.cloudinaryPublicId}" ` +
      `(FileRecord: ${fileRecordId}): ${err.message}`
    );
    throw err; // Re-throw so callers can handle the failure appropriately
  }

  await FileRecord.findByIdAndDelete(fileRecord._id);
};

/**
 * Silently attempts to delete a FileRecord and its Cloudinary asset.
 * Used during cleanup of partial uploads — errors are logged but not thrown.
 */
const tryDeleteFileRecord = async (fileRecordId) => {
  try {
    await deleteFileRecord(fileRecordId);
  } catch (err) {
    console.warn(`[Storage] Cleanup deletion warning for FileRecord ${fileRecordId}: ${err.message}`);
  }
};

module.exports = {
  validateFileBuffer,
  uploadFile,
  generateSignedDownloadUrl,
  fetchAuthenticatedFile,
  deleteFileRecord,
  tryDeleteFileRecord,
};
