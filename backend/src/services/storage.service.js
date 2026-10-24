/**
 * @file storage.service.js
 * @description Safe attachment and photo storage abstraction for CivicSarthi.
 * Supports image validation (MIME, size, magic bytes), sanitized local filesystem persistence,
 * and retrieval with directory-traversal prevention.
 */

import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

export const ALLOWED_IMAGE_MIME_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export const ALLOWED_IMAGE_EXTENSIONS = Object.freeze([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp'
]);

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export class StorageService {
  constructor(uploadsDir = null) {
    this.uploadsDir = uploadsDir || process.env.UPLOADS_DIR || DEFAULT_UPLOADS_DIR;
    this._ensureUploadsDirectory();
  }

  _ensureUploadsDirectory() {
    try {
      if (!fs.existsSync(this.uploadsDir)) {
        fs.mkdirSync(this.uploadsDir, { recursive: true });
      }
    } catch (err) {
      console.warn('[StorageService] Warning creating uploads directory:', err.message);
    }
  }

  /**
   * Validates binary buffer magic bytes against declared MIME type.
   */
  _validateMagicBytes(buffer, mimeType) {
    if (!buffer || buffer.length < 4) return false;

    // JPEG: FF D8 FF
    if (mimeType === 'image/jpeg') {
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }

    // PNG: 89 50 4E 47 (\x89PNG)
    if (mimeType === 'image/png') {
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    }

    // WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
    if (mimeType === 'image/webp') {
      if (buffer.length < 12) return false;
      const riff = buffer.slice(0, 4).toString('ascii');
      const webp = buffer.slice(8, 12).toString('ascii');
      return riff === 'RIFF' && webp === 'WEBP';
    }

    return false;
  }

  /**
   * Saves a base64 or binary image attachment safely to storage.
   *
   * @param {Object} params
   * @param {string} params.filename - Original uploaded file name
   * @param {string} params.mimeType - MIME type of the file
   * @param {string|Buffer} params.data - Base64 encoded string or Buffer
   * @returns {Promise<Object>} Stored attachment metadata
   */
  async saveAttachment({ filename, mimeType, data, base64Data }) {
    if (!filename || typeof filename !== 'string') {
      const err = new Error('Attachment filename is required');
      err.status = 400;
      err.code = 'INVALID_FILENAME';
      throw err;
    }

    const cleanOriginalName = path.basename(filename).replace(/[^\w\-.]/g, '_');
    const ext = path.extname(cleanOriginalName).toLowerCase();

    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      const err = new Error(`Unsupported file format or extension '${ext}'. Allowed image extensions: ${ALLOWED_IMAGE_EXTENSIONS.join(', ')}`);
      err.status = 400;
      err.code = 'INVALID_FILE_EXTENSION';
      throw err;
    }

    const normalizedMime = String(mimeType || '').toLowerCase().trim();
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(normalizedMime)) {
      const err = new Error(`Unsupported MIME type '${normalizedMime}'. Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`);
      err.status = 400;
      err.code = 'INVALID_MIME_TYPE';
      throw err;
    }

    // Convert data to buffer
    const rawData = data !== undefined ? data : base64Data;
    let buffer;
    if (Buffer.isBuffer(rawData)) {
      buffer = rawData;
    } else if (typeof rawData === 'string') {
      // Support Data URL format "data:image/jpeg;base64,..." or raw base64
      const base64Clean = rawData.includes(';base64,') ? rawData.split(';base64,')[1] : rawData;
      buffer = Buffer.from(base64Clean, 'base64');
    } else {
      const err = new Error('Invalid image data format. Expected Buffer or Base64 string');
      err.status = 400;
      err.code = 'INVALID_IMAGE_DATA';
      throw err;
    }

    // Validate size limit
    if (buffer.length === 0) {
      const err = new Error('Uploaded file is empty (0 bytes)');
      err.status = 400;
      err.code = 'FILE_EMPTY';
      throw err;
    }

    if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      const err = new Error(`File size (${sizeMB} MB) exceeds maximum allowed limit of 5MB`);
      err.status = 400;
      err.code = 'FILE_TOO_LARGE';
      throw err;
    }

    // Validate magic bytes
    if (!this._validateMagicBytes(buffer, normalizedMime)) {
      const err = new Error(`Corrupted file content or binary magic number does not match declared image format (${normalizedMime})`);
      err.status = 400;
      err.code = 'CORRUPTED_OR_DISGUISED_FILE';
      throw err;
    }

    // Generate unique, sanitized filename
    const safeExt = ext === '.jpeg' ? '.jpg' : ext;
    const uniqueId = crypto.randomBytes(4).toString('hex');
    const safeStoredFilename = `ATTACH-${Date.now()}-${uniqueId}${safeExt}`;
    const destinationPath = path.join(this.uploadsDir, safeStoredFilename);

    await fsp.writeFile(destinationPath, buffer);

    return {
      filename: safeStoredFilename,
      originalName: cleanOriginalName,
      mimeType: normalizedMime,
      size: buffer.length,
      url: `/api/v1/complaints/attachments/${safeStoredFilename}`,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Retrieves a safe, validated file path for an attachment.
   * Strictly prevents directory traversal.
   */
  async getAttachmentFile(filename) {
    if (!filename || typeof filename !== 'string') {
      const err = new Error('Attachment filename is required');
      err.status = 400;
      err.code = 'INVALID_FILENAME';
      throw err;
    }

    // Anti-traversal checks
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes(':')) {
      const err = new Error('Access denied: invalid attachment reference with illegal path characters');
      err.status = 403;
      err.code = 'PATH_TRAVERSAL_DETECTED';
      throw err;
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(this.uploadsDir, safeFilename);

    try {
      await fsp.access(filePath, fs.constants.R_OK);
      const stats = await fsp.stat(filePath);
      const ext = path.extname(safeFilename).toLowerCase();
      let mimeType = 'application/octet-stream';
      if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';

      return {
        filePath,
        filename: safeFilename,
        size: stats.size,
        mimeType
      };
    } catch {
      const err = new Error('Requested attachment was not found on server storage');
      err.status = 404;
      err.code = 'ATTACHMENT_NOT_FOUND';
      throw err;
    }
  }

  /**
   * Returns sanitized absolute path for a filename, strictly validating against directory traversal.
   */
  getAttachmentPath(filename) {
    if (!filename || typeof filename !== 'string') {
      const err = new Error('Invalid or suspicious attachment filename');
      err.status = 400;
      err.code = 'INVALID_FILENAME';
      throw err;
    }

    if (filename.includes('..') || filename.includes('/') || filename.includes('\\') || filename.includes(':')) {
      const err = new Error('Invalid or suspicious attachment filename: path traversal detected');
      err.status = 403;
      err.code = 'PATH_TRAVERSAL_DETECTED';
      throw err;
    }

    return path.join(this.uploadsDir, path.basename(filename));
  }
}

export const storageService = new StorageService();
export default storageService;
