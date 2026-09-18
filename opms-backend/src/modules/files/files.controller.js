/**
 * @fileoverview Files: HTTP handlers (thin controllers).
 * @module modules/files/files.controller
 */
const asyncHandler = require('../../utils/asyncHandler');
const {
  getViewPresignedUrl,
  getDownloadPresignedUrl,
} = require('../../services/fileManagement/index');
const { getModels } = require('../../data/mongoRegistry');
const { ApiError } = require('../../utils/ApiError');
const mongoose = require('mongoose');

async function findAttachmentRecord(fileId) {
  if (!fileId || !mongoose.Types.ObjectId.isValid(fileId)) return null;
  const models = getModels();
  const Attachment = models.Attachment;
  const OrderDueSheet = models.OrderDueSheet;

  let att = null;
  if (Attachment) {
    att = await Attachment.findById(fileId).lean();
  }

  if (!att && OrderDueSheet) {
    const dueSheet = await OrderDueSheet.findById(fileId).lean();
    if (dueSheet) {
      if (dueSheet.document && Attachment) {
        att = await Attachment.findById(dueSheet.document).lean();
      }
      if (!att && Attachment) {
        att = await Attachment.findOne({ entity_id: dueSheet._id })
          .sort({ createdAt: -1 })
          .lean();
      }
    }
  }

  if (!att && Attachment) {
    att = await Attachment.findOne({ entity_id: fileId }).sort({ createdAt: -1 }).lean();
  }

  return att;
}

function resolveTargetFmId(fileId, att) {
  if (!att) return fileId;
  const entityIdStr = String(att.entity_id || att.order || att._id || '');

  if (att.filename && !String(att.filename).includes('/')) {
    return String(att.filename);
  }
  if (att.fileId && !String(att.fileId).includes('/')) {
    return String(att.fileId);
  }

  const keyVal = att.key || att.storage_path || att.file_key;
  if (keyVal) {
    const parts = String(keyVal).split('/');
    const lastPart = parts[parts.length - 1];
    if (lastPart && lastPart !== entityIdStr && lastPart !== String(att._id || '')) {
      return lastPart;
    }
  }

  if (att.url) {
    const match = String(att.url).match(/\/api\/files\/([^/?#]+)/);
    if (match && match[1] && match[1] !== 'view' && match[1] !== 'download') {
      const candidate = match[1];
      if (candidate !== entityIdStr && candidate !== String(att._id || '')) {
        return candidate;
      }
    }
  }

  return fileId;
}

exports.redirectToViewUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes('/api/files/')) {
    return res.redirect(302, att.url);
  }

  const targetFmId = resolveTargetFmId(fileId, att);

  try {
    const presignedUrl = await getViewPresignedUrl(targetFmId);
    if (presignedUrl) {
      return res.redirect(302, presignedUrl);
    }
  } catch (_fmErr) {
    if (targetFmId !== fileId) {
      try {
        const presignedUrl = await getViewPresignedUrl(fileId);
        if (presignedUrl) {
          return res.redirect(302, presignedUrl);
        }
      } catch (_e) {
        // continue
      }
    }
  }

  if (att && att.url && !att.url.includes(`/api/files/${fileId}/view`)) {
    return res.redirect(302, att.url);
  }

  throw new ApiError(404, 'File not found or file-management service unable to resolve view URL');
});

exports.redirectToDownloadUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att && att.url && /^https?:\/\//i.test(att.url) && !att.url.includes('/api/files/')) {
    return res.redirect(302, att.url);
  }

  const targetFmId = resolveTargetFmId(fileId, att);

  try {
    const presignedUrl = await getDownloadPresignedUrl(targetFmId);
    if (presignedUrl) {
      return res.redirect(302, presignedUrl);
    }
  } catch (_fmErr) {
    if (targetFmId !== fileId) {
      try {
        const presignedUrl = await getDownloadPresignedUrl(fileId);
        if (presignedUrl) {
          return res.redirect(302, presignedUrl);
        }
      } catch (_e) {
        // continue
      }
    }
  }

  if (att && att.url && !att.url.includes(`/api/files/${fileId}/download`)) {
    return res.redirect(302, att.url);
  }

  throw new ApiError(404, 'File not found or file-management service unable to resolve download URL');
});
