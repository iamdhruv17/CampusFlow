/**
 * File Controller
 *
 * Handles authenticated document access via Cloudinary signed URLs.
 *
 * Security model:
 * - Every request is authenticated (JWT cookie checked by protect middleware)
 * - Authorization is checked against the associated Request document
 * - A signed URL is generated on the backend using the API secret
 * - The signed URL is time-limited (5 minutes) and returned as JSON
 * - Preview binary contents are streamed through this server
 * - No permanent public URLs are stored or returned
 */

const FileRecord = require('../models/FileRecord');
const Request = require('../models/Request');
const ApprovalHistory = require('../models/ApprovalHistory');
const {
  generateSignedDownloadUrl,
  fetchAuthenticatedFile,
} = require('../services/storage.service');
const { sendSuccess, sendError } = require('../utils/apiResponse');

const PREVIEW_CONTENT_TYPES = {
  'application/pdf': { contentType: 'application/pdf', extension: 'pdf' },
  'image/jpeg': { contentType: 'image/jpeg', extension: 'jpg' },
  'image/jpg': { contentType: 'image/jpeg', extension: 'jpg' },
  'image/png': { contentType: 'image/png', extension: 'png' },
};

const authorizeFileAccess = async (fileRecord, user) => {
  const request = await Request.findById(fileRecord.requestId);
  if (!request) return { request: null, authorized: false };

  const userId = user._id.toString();
  const userRole = user.role;
  const isOwner = request.requesterId.toString() === userId;
  const isCurrentApprover =
    request.currentApproverId &&
    request.currentApproverId.toString() === userId;
  const isAdmin = userRole === 'admin';
  const isStudentOwner = userRole === 'student' && isOwner;
  const isAssignedStaff =
    userRole !== 'student' && userRole !== 'admin' && isCurrentApprover;

  let authorized = isAdmin || isStudentOwner || isAssignedStaff;
  if (!authorized && userRole !== 'student' && !isAdmin) {
    authorized = Boolean(await ApprovalHistory.exists({
      requestId: request._id,
      actorId: user._id,
    }));
  }

  return { request, authorized };
};

const getPreviewFileName = (originalName, extension) => {
  const cleanedName = String(originalName || '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, 200);
  const fallback = `document.${extension}`;
  const safeName = cleanedName || fallback;
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return {
    asciiName: asciiName || fallback,
    encodedName: encodeURIComponent(safeName),
  };
};

const getAuthorizedFile = async (req, res) => {
  const fileRecord = await FileRecord.findById(req.params.id);
  if (!fileRecord) {
    sendError(res, 404, 'File not found.');
    return null;
  }

  const { request, authorized } = await authorizeFileAccess(fileRecord, req.user);
  if (!request) {
    sendError(res, 404, 'Associated request not found.');
    return null;
  }
  if (!authorized) {
    sendError(res, 403, 'Access denied.');
    return null;
  }

  return fileRecord;
};

/**
 * GET /api/files/:id
 *
 * Returns a time-limited signed Cloudinary download URL for the requested file,
 * or JSON metadata if ?meta=true is provided.
 *
 * Authorization rules:
 *   Student  — own requests only
 *   Staff    — currently assigned as approver OR has acted on the request (ApprovalHistory)
 *   Admin    — all requests
 *
 * The signed URL returned is a temporary bearer link (5-minute expiry).
 * The application performs its own authorization check before generating it.
 * Never trust the file ID from the frontend without verifying ownership.
 */
const getFile = async (req, res, next) => {
  try {
    const fileRecord = await getAuthorizedFile(req, res);
    if (!fileRecord) return;

    // Return JSON metadata only (no signed URL) when ?meta=true
    if (req.query.meta === 'true') {
      return sendSuccess(res, 200, 'File metadata retrieved.', {
        file: {
          id: fileRecord._id,
          originalName: fileRecord.originalName,
          mimeType: fileRecord.mimeType,
          fileSize: fileRecord.fileSize,
          format: fileRecord.format,
          uploadedAt: fileRecord.createdAt,
        },
      });
    }

    // Generate a time-limited signed download URL on the backend
    // This uses the API secret — never exposed to the frontend
    const { signedUrl, expiresAt } = generateSignedDownloadUrl(fileRecord);

    return sendSuccess(res, 200, 'Signed download URL generated.', {
      signedUrl,
      expiresAt,       // Unix timestamp — frontend can show expiry if needed
      fileName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
      fileSize: fileRecord.fileSize,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/files/:id/preview
 *
 * Streams an authorized authenticated Cloudinary asset with browser-preview
 * headers. The asset remains private in Cloudinary and is never exposed by URL.
 */
const previewFile = async (req, res, next) => {
  try {
    const fileRecord = await getAuthorizedFile(req, res);
    if (!fileRecord) return;

    const previewType = PREVIEW_CONTENT_TYPES[fileRecord.mimeType?.toLowerCase()];
    if (!previewType) {
      return sendError(res, 415, 'This document type cannot be previewed.');
    }

    const { asciiName, encodedName } = getPreviewFileName(
      fileRecord.originalName,
      previewType.extension
    );
    const stream = await fetchAuthenticatedFile(fileRecord);

    res.set({
      'Content-Type': previewType.contentType,
      'Content-Disposition': `inline; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, no-store, max-age=0',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'",
    });
    if (Number.isSafeInteger(fileRecord.fileSize) && fileRecord.fileSize >= 0) {
      res.set('Content-Length', String(fileRecord.fileSize));
    }

    stream.on('error', (error) => {
      if (!res.headersSent) return next(error);
      res.destroy(error);
    });
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
};

module.exports = { getFile, previewFile };
