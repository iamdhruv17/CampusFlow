const mongoose = require('mongoose');


const fileRecordSchema = new mongoose.Schema(
  {
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Request',
      default: null,
    },
    originalName: {
      type: String,
      required: true,
      trim: true,
    },
    // Stable Cloudinary asset identifier — used as a canonical reference
    cloudinaryAssetId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
    },
    // Cloudinary public_id — used for API calls (upload, delete, signed URL)
    cloudinaryPublicId: {
      type: String,
      required: true,
      unique: true,
      sparse: true,
      index: true,
    },
    // Always "raw" for documents to preserve the original file
    resourceType: {
      type: String,
      required: true,
      default: 'raw',
    },
    // Always "authenticated" — private delivery, no public access
    deliveryType: {
      type: String,
      required: true,
      default: 'authenticated',
    },
    // Format returned by Cloudinary (e.g. "pdf", "jpg", "png")
    format: {
      type: String,
      required: true,
    },
    mimeType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

fileRecordSchema.index({ uploaderId: 1 });
fileRecordSchema.index({ requestId: 1 });

module.exports = mongoose.model('FileRecord', fileRecordSchema);
