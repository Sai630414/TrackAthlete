const crypto = require('crypto');

function normalizeAadhaar(value) {
  return String(value || '').replace(/\D/g, '');
}

function hashAadhaar(value) {
  const normalized = normalizeAadhaar(value);
  if (normalized.length !== 12) return null;
  const secret = process.env.JWT_SECRET || 'trackathlete_sih_secret_2026';
  return crypto.createHmac('sha256', secret).update(normalized).digest('hex');
}

function withoutAadhaar(document) {
  if (!document) return document;
  const value = typeof document.toObject === 'function' ? document.toObject() : { ...document };
  delete value.aadhaarHash;
  delete value.athleteIdentityReference;
  delete value.aadhaar;
  delete value.aadhaarNumber;
  if (value.sport) value.sport = String(value.sport).trim();
  return value;
}

module.exports = { normalizeAadhaar, hashAadhaar, withoutAadhaar };
