const bcrypt = require("bcrypt");

const SALT_ROUNDS = 10;

/**
 * Hashes a plain-text password using bcrypt.
 * @param {string} plainPassword - The plain-text password.
 * @returns {Promise<string>} The resulting bcrypt hash.
 */
async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a stored bcrypt hash.
 * @param {string} plainPassword - The plain-text password.
 * @param {string} hash - The stored bcrypt hash.
 * @returns {Promise<boolean>} True when the password matches the hash.
 */
async function verifyPassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, verifyPassword };
