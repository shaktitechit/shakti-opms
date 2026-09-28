/**
 * @fileoverview Credential encryption/decryption utility using AES-256-GCM.
 * @module utils/credentialEncryption
 */
const crypto = require('crypto');
const { JWT_SECRET } = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a consistent 32-byte encryption key from environment secrets.
 */
function getEncryptionKey() {
  const secret = process.env.EMAIL_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || JWT_SECRET || 'default-insecure-opms-encryption-key-32chars';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

/**
 * Encrypts a plaintext string.
 * @param {string} text - The plaintext to encrypt.
 * @returns {string|null} Base64-encoded encrypted payload (iv + authTag + ciphertext) or null.
 */
function encrypt(text) {
  if (text === undefined || text === null || text === '') {
    return text;
  }
  const strText = String(text);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(strText, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine iv (16 bytes) + authTag (16 bytes) + encrypted content
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts an encrypted base64 payload.
 * @param {string} encryptedBase64 - The base64 encrypted payload.
 * @returns {string|null} The decrypted plaintext string or original value if not encrypted.
 */
function decrypt(encryptedBase64) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
    return encryptedBase64;
  }

  try {
    const combined = Buffer.from(encryptedBase64, 'base64');
    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH) {
      return encryptedBase64;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encryptedText = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (_err) {
    // If decryption fails (e.g. unencrypted legacy string), return as is
    return encryptedBase64;
  }
}

module.exports = {
  encrypt,
  decrypt,
};
