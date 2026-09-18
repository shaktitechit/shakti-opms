/**
 * @fileoverview Attachments: HTTP handlers (thin controllers).
 * @module modules/attachments/attachment.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const service = require('./attachment.service');
const { uploadMulterFile, getFileMeta, getViewPresignedUrl } = require('../../services/fileManagement/index');
const { API_PUBLIC_BASE_URL, FILE_DOCUMENT_LINKS_RELATIVE } = require('../../config/fileManagement');

function resolveFileId(item) {
  if (!item) return null;
  const entityIdStr = String(item.entity_id || item.order || item._id || '');

  if (item.filename && !String(item.filename).includes('/')) {
    return String(item.filename);
  }
  if (item.fileId && !String(item.fileId).includes('/')) {
    return String(item.fileId);
  }
  if (item.key) {
    const parts = String(item.key).split('/');
    const last = parts[parts.length - 1];
    if (last && last !== entityIdStr && last !== String(item._id || '')) {
      return last;
    }
  }
  if (item.url) {
    const match = String(item.url).match(/\/(?:api\/)?files\/([^/?#]+)/);
    if (match && match[1] && match[1] !== 'view' && match[1] !== 'download') {
      const candidate = match[1];
      if (candidate !== entityIdStr && candidate !== String(item._id || '')) {
        return candidate;
      }
    }
  }
  return null;
}

async function withFreshViewUrl(item) {
  if (!item) return item;
  const obj = typeof item.toObject === 'function' ? item.toObject() : { ...item };
  const fileId = resolveFileId(obj);
  if (!fileId) return obj;

  try {
    const freshUrl = await getViewPresignedUrl(fileId);
    if (freshUrl) {
      obj.url = freshUrl;
    }
  } catch (_err) {
    // Keep stored url if FM lookup fails
  }
  return obj;
}

exports.list = asyncHandler(async (req, res) => {
  const data = await service.list(req.query);
  res.json({
    success: true,
    data: await Promise.all(data.map(withFreshViewUrl)),
  });
});

exports.get = asyncHandler(async (req, res) => {
  const data = await service.get(req.params.id);
  res.json({ success: true, data: await withFreshViewUrl(data) });
});

exports.create = asyncHandler(async (req, res) => {
  const body = { ...req.body };
  if (req.file) {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) {
      res.status(400);
      throw new Error('entity_type and entity_id are required when uploading a file');
    }

    const fileId = await uploadMulterFile(req.file, entity_type, entity_id);
    const meta = await getFileMeta(fileId);
    let viewUrl = null;
    try {
      viewUrl = await getViewPresignedUrl(fileId);
    } catch (_err) {
      // Fallback
    }

    const base = FILE_DOCUMENT_LINKS_RELATIVE ? '' : API_PUBLIC_BASE_URL;

    body.filename = fileId;
    body.storage_path = meta.objectKey || fileId;
    body.original_name = meta.originalName || req.file.originalname;
    body.file_name = meta.originalName || req.file.originalname;
    body.mime_type = meta.mimeType || req.file.mimetype;
    body.size = meta.sizeBytes || req.file.size;
    body.storage_provider = 'minio';
    body.bucket = meta.bucket || 'company-files';
    body.key = meta.objectKey || fileId;
    body.url = viewUrl || `${base}/api/files/${fileId}/view`;
  }

  const created = await service.create(body, req.user);
  res.status(201).json({ success: true, data: await withFreshViewUrl(created) });
});

exports.remove = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.remove(req.params.id, req.user) });
});

exports.restore = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await service.restore(req.params.id, req.user) });
});

exports.listDeleted = asyncHandler(async (req, res) => {
  const data = await service.listDeleted(req.query);
  res.json({
    success: true,
    data: await Promise.all(data.map(withFreshViewUrl)),
  });
});
