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
    if (dueSheet && dueSheet.document && Attachment) {
      att = await Attachment.findById(dueSheet.document).lean();
    }
  }
  if (!att && Attachment) {
    att = await Attachment.findOne({ entity_id: fileId }).sort({ createdAt: -1 }).lean();
  }
  return att;
}

exports.redirectToViewUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att) {
    if (att.url && /^https?:\/\//i.test(att.url)) {
      return res.redirect(302, att.url);
    }

    if (att.url) {
      const match = String(att.url).match(/\/api\/files\/([^/?#]+)/);
      if (match && match[1] && match[1] !== "view" && match[1] !== "download" && match[1] !== fileId) {
        try {
          const url = await getViewPresignedUrl(match[1]);
          if (url) return res.redirect(302, url);
        } catch (_err) {
          // continue fallback
        }
      }
    }

    const keyVal = att.key || att.file_id || att.fileId || att.file_key;
    if (keyVal) {
      const parts = String(keyVal).split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== fileId) {
        try {
          const url = await getViewPresignedUrl(lastPart);
          if (url) return res.redirect(302, url);
        } catch (_err) {
          // continue fallback
        }
      }
    }

    if (att.url && !att.url.includes(`/api/files/${fileId}/`)) {
      return res.redirect(302, att.url);
    }
  }

  const url = await getViewPresignedUrl(fileId);
  return res.redirect(302, url);
});

exports.redirectToDownloadUrl = asyncHandler(async (req, res) => {
  const fileId = req.params.fileId;
  const att = await findAttachmentRecord(fileId);

  if (att) {
    if (att.url && /^https?:\/\//i.test(att.url)) {
      return res.redirect(302, att.url);
    }

    if (att.url) {
      const match = String(att.url).match(/\/api\/files\/([^/?#]+)/);
      if (match && match[1] && match[1] !== "view" && match[1] !== "download" && match[1] !== fileId) {
        try {
          const url = await getDownloadPresignedUrl(match[1]);
          if (url) return res.redirect(302, url);
        } catch (_err) {
          // continue fallback
        }
      }
    }

    const keyVal = att.key || att.file_id || att.fileId || att.file_key;
    if (keyVal) {
      const parts = String(keyVal).split("/");
      const lastPart = parts[parts.length - 1];
      if (lastPart && lastPart !== fileId) {
        try {
          const url = await getDownloadPresignedUrl(lastPart);
          if (url) return res.redirect(302, url);
        } catch (_err) {
          // continue fallback
        }
      }
    }

    if (att.url && !att.url.includes(`/api/files/${fileId}/`)) {
      return res.redirect(302, att.url);
    }
  }

  const url = await getDownloadPresignedUrl(fileId);
  return res.redirect(302, url);
});
