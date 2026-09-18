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

/**
 * Resolve the FM fileId from what was passed.
 *
 * `invoice_file` (and similar) stores an Attachment ObjectId.
 * The Attachment's `url` field contains the actual FM fileId, e.g.
 *   "http://localhost:5000/api/files/<fmFileId>/view"
 * We extract <fmFileId> from that URL.
 *
 * If the param is NOT a valid ObjectId (already an FM fileId), pass through.
 */
async function resolveFmFileId(fileId) {
  if (!fileId) return fileId;

  if (mongoose.Types.ObjectId.isValid(fileId)) {
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
      att = await Attachment.findOne({ entity_id: fileId })
        .sort({ createdAt: -1 })
        .lean();
    }

    if (att) {
      if (att.url) {
        const match = String(att.url).match(/\/api\/files\/([^/?#]+)/);
        if (match && match[1] && match[1] !== "view" && match[1] !== "download") {
          return match[1];
        }
      }
      const keyVal = att.key || att.file_id || att.fileId || att.file_key;
      if (keyVal) {
        const parts = String(keyVal).split("/");
        const lastPart = parts[parts.length - 1];
        if (lastPart) return lastPart;
      }
    }
  }

  return fileId;
}

exports.redirectToViewUrl = asyncHandler(async (req, res) => {
  const fmId = await resolveFmFileId(req.params.fileId);
  const url = await getViewPresignedUrl(fmId);
  res.redirect(302, url);
});

exports.redirectToDownloadUrl = asyncHandler(async (req, res) => {
  const fmId = await resolveFmFileId(req.params.fileId);
  const url = await getDownloadPresignedUrl(fmId);
  res.redirect(302, url);
});
