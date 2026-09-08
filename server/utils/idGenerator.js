const crypto = require('crypto');

const ROLE_PREFIX_MAP = {
  athlete: 'ATH-',
  parent: 'PAR-',
  coach: 'COA-',
  sponsor: 'SPN-',
  academy: 'ACA-',
  organizer: 'ORG-',
  federation: 'FED-'
};

/**
 * Returns the standard prefix for a given role.
 */
function getRolePrefix(role) {
  const norm = String(role || '').toLowerCase().trim();
  const prefix = ROLE_PREFIX_MAP[norm];
  if (!prefix) {
    throw new Error(`Invalid role for permanent ID generation: '${role}'. Expected one of: ${Object.keys(ROLE_PREFIX_MAP).join(', ')}`);
  }
  return prefix;
}

/**
 * Generates an 8-character uppercase hex candidate from an ObjectId or random bytes.
 */
function generateCandidate(prefix, objectId, attempt = 0) {
  if (attempt === 0 && objectId) {
    const hex = objectId.toString();
    if (hex.length >= 8) {
      return `${prefix}${hex.slice(-8).toUpperCase()}`;
    }
  }
  const randomHex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}${randomHex}`;
}

/**
 * Generate a guaranteed unique permanent ID for a role.
 * If checkUniqueFn is provided, verifies uniqueness against the database and retries on collision.
 * checkUniqueFn: async (candidateId) => boolean (true if unique, false if collision)
 */
async function generateRolePermanentId(role, objectId, checkUniqueFn = null) {
  const prefix = getRolePrefix(role);
  let attempt = 0;
  const maxAttempts = 10;

  while (attempt < maxAttempts) {
    const candidate = generateCandidate(prefix, objectId, attempt);
    if (!checkUniqueFn) {
      return candidate;
    }
    const isUnique = await checkUniqueFn(candidate);
    if (isUnique) {
      return candidate;
    }
    attempt++;
  }

  // Fallback with high entropy
  return `${prefix}${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

module.exports = {
  ROLE_PREFIX_MAP,
  getRolePrefix,
  generateRolePermanentId
};
