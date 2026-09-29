/**
 * @fileoverview File management integration service for work-planner-backend.
 * Calls the file-management API directly (initiate / complete / view-url).
 * @module services/fileManagement
 */
const axios = require('axios');
const mongoose = require('mongoose');
const { FILE_MANAGEMENT_API_URL, FILE_MANAGEMENT_API_KEY } = require('../config/env');
const { getModels } = require('../data/mongoRegistry');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function fmHeaders(extra = {}) {
  return {
    'X-Api-Key': FILE_MANAGEMENT_API_KEY,
    ...extra,
  };
}

async function getFileMeta(fileId) {
  const response = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${fileId}`, {
    headers: fmHeaders(),
  });
  return response.data;
}

/**
 * Resolve a short-lived presigned view URL from the file-management API.
 * @param {string} fileId
 * @returns {Promise<string>}
 */
async function getViewPresignedUrl(fileId) {
  if (!fileId) throw new Error('No fileId provided');
  const candidates = [fileId];
  if (typeof fileId === 'string' && fileId.includes('.')) {
    candidates.push(fileId.split('.')[0]);
  }

  for (const cid of candidates) {
    try {
      const { data } = await axios.get(`${FILE_MANAGEMENT_API_URL}/files/${cid}/view-url`, {
        headers: fmHeaders(),
        timeout: 8000,
      });
      const url = data?.url || data?.viewUrl;
      if (url) return url;
    } catch (_err) {}
  }

  throw new Error(`File management API did not return a view URL for ${fileId}`);
}

function resolveFileIdCandidateList(item) {
  if (!item) return [];
  const list = [];
  if (typeof item === 'string') {
    const resMatch = item.match(/\/resource\/[^/]+\/([a-f0-9]{24})\//i);
    if (resMatch?.[1]) list.push(resMatch[1]);

    const origMatch = item.match(/\/original\/([^/?#]+)/i);
    if (origMatch?.[1]) list.push(origMatch[1]);

    const fileMatch = item.match(/\/(?:api\/)?files\/([^/?#]+)/i);
    if (fileMatch?.[1]) list.push(fileMatch[1]);

    const uuidMatch = item.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.[a-z0-9]+)/i);
    if (uuidMatch?.[1]) list.push(uuidMatch[1]);
  } else if (typeof item === 'object') {
    if (item._id) list.push(String(item._id));
    if (item.filename && !String(item.filename).includes('/')) list.push(String(item.filename));
    if (item.storage_path) list.push(...resolveFileIdCandidateList(String(item.storage_path)));
    if (item.url) list.push(...resolveFileIdCandidateList(String(item.url)));
  }
  return [...new Set(list)].filter(Boolean);
}

function resolveFileId(item) {
  const candidates = resolveFileIdCandidateList(item);
  return candidates[0] || null;
}

/**
 * Replace a stored/legacy attachment URL with a fresh file-manager view URL.
 * @param {object|null} item
 * @returns {Promise<object|null>}
 */
async function withFreshViewUrl(item) {
  if (!item) return item;
  const obj = item.toObject ? item.toObject() : { ...item };
  const candidates = resolveFileIdCandidateList(obj);
  if (candidates.length === 0) return obj;

  for (const cid of candidates) {
    try {
      obj.url = await getViewPresignedUrl(cid);
      return obj;
    } catch (_e) {}
  }
  return obj;
}

async function refreshUrlString(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return urlStr;
  const candidates = resolveFileIdCandidateList(urlStr);
  if (candidates.length === 0) return urlStr;

  for (const cid of candidates) {
    try {
      const fresh = await getViewPresignedUrl(cid);
      if (fresh) return fresh;
    } catch (_e) {}
  }
  return urlStr;
}

/**
 * Refresh signed view URLs for visit selfie images.
 * @param {object} visit
 * @returns {Promise<object>}
 */
async function withFreshVisitSelfieUrls(visit) {
  if (!visit) return visit;
  const out = { ...visit };
  if (out.check_in_selfie_url) {
    out.check_in_selfie_url = await refreshUrlString(out.check_in_selfie_url);
  }
  if (out.check_out_selfie_url) {
    out.check_out_selfie_url = await refreshUrlString(out.check_out_selfie_url);
  }
  if (out.outcome_selfie_url) {
    out.outcome_selfie_url = await refreshUrlString(out.outcome_selfie_url);
  }

  if (!out.check_out_selfie_url && out.outcome_selfie_url) {
    out.check_out_selfie_url = out.outcome_selfie_url;
  }
  if (!out.outcome_selfie_url && out.check_out_selfie_url) {
    out.outcome_selfie_url = out.check_out_selfie_url;
  }

  if (!out.check_in_address && typeof out.check_in_lat === 'number' && typeof out.check_in_lng === 'number') {
    out.check_in_address = `Lat: ${out.check_in_lat.toFixed(4)}, Lng: ${out.check_in_lng.toFixed(4)}`;
  }
  if (!out.check_out_address && typeof out.check_out_lat === 'number' && typeof out.check_out_lng === 'number') {
    out.check_out_address = `Lat: ${out.check_out_lat.toFixed(4)}, Lng: ${out.check_out_lng.toFixed(4)}`;
  }

  if (!out.check_out_address && out.check_in_address) {
    out.check_out_address = out.check_in_address;
    if (out.check_out_lat === undefined || out.check_out_lat === null) {
      out.check_out_lat = out.check_in_lat;
      out.check_out_lng = out.check_in_lng;
    }
  }
  if (!out.check_in_address && out.check_out_address) {
    out.check_in_address = out.check_out_address;
    if (out.check_in_lat === undefined || out.check_in_lat === null) {
      out.check_in_lat = out.check_out_lat;
      out.check_in_lng = out.check_out_lng;
    }
  }

  if (!out.check_in_address && out.address) {
    out.check_in_address = out.address;
  }
  if (!out.check_out_address && out.address) {
    out.check_out_address = out.address;
  }

  return out;
}

/**
 * Refresh view URLs on common expense attachment fields.
 * @param {object} expense
 * @returns {Promise<object>}
 */
async function withFreshExpenseAttachmentUrls(expense) {
  if (!expense) return expense;
  const out = { ...expense };
  const fields = ['receipt_attachment', 'start_reading_image', 'end_reading_image'];
  await Promise.all(
    fields.map(async (field) => {
      if (out[field] && typeof out[field] === 'object') {
        out[field] = await withFreshViewUrl(out[field]);
      }
    }),
  );
  if (Array.isArray(out.attachments) && out.attachments.length > 0) {
    out.attachments = await Promise.all(
      out.attachments.map(async (att) => {
        if (att && typeof att === 'object') {
          return withFreshViewUrl(att);
        }
        return att;
      }),
    );
  }
  return out;
}

async function waitUntilFileAccessible(fileId) {
  const start = Date.now();
  const maxWait = 15000;
  const interval = 500;

  while (Date.now() - start < maxWait) {
    try {
      const meta = await getFileMeta(fileId);
      if (meta.status === 'ready' || meta.status === 'uploaded') {
        return meta;
      }
      if (meta.status === 'failed' || meta.scanStatus === 'infected') {
        throw new Error('File failed processing or virus check in file management service');
      }
    } catch (err) {
      if (err.message && err.message.includes('File failed processing')) {
        throw err;
      }
    }
    await sleep(interval);
  }

  return getFileMeta(fileId);
}

/**
 * Upload a Multer file to object storage via file-management API and save Attachment document.
 * @param {object} file Multer file object
 * @param {string} resourceType Resource type label (e.g., 'work_plan_expense')
 * @param {string} resourceId Resource ID string (Must be a valid 24-hex Mongo ObjectId)
 * @returns {Promise<object>} Created Mongoose Attachment object
 */
async function uploadMulterFile(file, resourceType = 'work_plan_expense', resourceId = null) {
  if (!file || !file.buffer || file.buffer.length < 1) {
    throw new Error('Empty or invalid file buffer');
  }

  const validResourceId =
    resourceId && mongoose.Types.ObjectId.isValid(resourceId)
      ? String(resourceId)
      : new mongoose.Types.ObjectId().toHexString();

  const originalName = file.originalname ? file.originalname.trim() : 'receipt.pdf';
  const mimeType = file.mimetype || 'application/octet-stream';
  const sizeBytes = file.buffer.length;

  let initiateRes;
  try {
    initiateRes = await axios.post(
      `${FILE_MANAGEMENT_API_URL}/files/upload/initiate`,
      {
        originalName,
        sizeBytes,
        mimeType,
        resourceType,
        resourceId: validResourceId,
      },
      {
        headers: fmHeaders({ 'Content-Type': 'application/json' }),
      },
    );
  } catch (err) {
    const errorDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`File Management initiate failed: ${errorDetails}`);
  }

  const initiate = initiateRes.data;
  const { fileId, presignedUrl, headers = {} } = initiate;

  const putHeaders = { ...headers };
  if (!putHeaders['Content-Type'] && !putHeaders['content-type']) {
    putHeaders['Content-Type'] = mimeType;
  }

  await axios.put(presignedUrl, file.buffer, {
    headers: putHeaders,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });

  await axios.post(
    `${FILE_MANAGEMENT_API_URL}/files/upload/complete`,
    { fileId },
    {
      headers: fmHeaders({ 'Content-Type': 'application/json' }),
    },
  );

  const meta = await waitUntilFileAccessible(fileId);
  const viewUrl = await getViewPresignedUrl(fileId);

  const { Attachment } = getModels();
  const attachmentData = {
    filename: fileId,
    original_name: meta.originalName || originalName,
    file_name: meta.originalName || originalName,
    mime_type: meta.mimeType || mimeType,
    size: meta.sizeBytes || sizeBytes,
    storage_path: meta.objectKey || fileId,
    // Direct file-manager presigned view URL (refreshed on read via filename/fileId).
    url: viewUrl,
  };

  const attachment = await Attachment.create(attachmentData);
  return attachment;
}

module.exports = {
  uploadMulterFile,
  getFileMeta,
  getViewPresignedUrl,
  resolveFileId,
  withFreshViewUrl,
  withFreshVisitSelfieUrls,
  withFreshExpenseAttachmentUrls,
};
