const User = require("../models/user");
const Role = require("../models/role");
const sequelize = require("../database");
const {
  ISSUE_STATUS,
  CONSUME_STATUS,
  issueCode,
  consumeCode,
  invalidateCodes,
} = require("./recovery-codes");
const { sendRecoveryCode } = require("./mailer");

/**
 * Requests a recovery code for the given email. Unknown emails report no
 * cooldown so the caller can answer with the same generic response, avoiding
 * user enumeration. A delivery failure rejects with MailDeliveryError and
 * rolls the persisted code back.
 * @param {string} email - Email sent by the client.
 * @returns {Promise<{ cooldown: boolean }>} Whether the resend cooldown is active.
 */
async function requestPasswordReset(email) {
  const user = await User.findOne({ where: { email } });

  if (!user) {
    return { cooldown: false };
  }

  const result = await issueCode(user.id, {
    sendCode: (code) => sendRecoveryCode(user.email, code),
  });

  return { cooldown: result.status === ISSUE_STATUS.COOLDOWN };
}

/**
 * Validates and consumes a recovery code. Unknown users and invalid, expired
 * or already used codes share the same invalid result. A blocked user is
 * reported as blocked before consuming the code, so a suspended account can
 * never start a session with a valid code.
 * @param {string} email - Email sent by the client.
 * @param {string} code - Plain 8-digit code sent by the client.
 * @returns {Promise<{ valid: boolean, blocked?: boolean, user?: object }>} The
 *   user when valid, or a blocked flag when the account is suspended.
 */
async function verifyResetCode(email, code) {
  const user = await User.findOne({
    where: { email },
    include: { model: Role, as: "role" },
  });

  if (!user) {
    return { valid: false };
  }

  if (user.isBlocked) {
    return { blocked: true };
  }

  const result = await consumeCode(user.id, code);

  if (result.status !== CONSUME_STATUS.VALID) {
    return { valid: false };
  }

  return { valid: true, user };
}

/**
 * Updates the password of an authenticated user and invalidates every pending
 * recovery code inside the same transaction.
 * @param {number} userId - Authenticated user primary key.
 * @param {string} password - New plain-text password.
 * @returns {Promise<{ found: boolean }>} Whether the user still exists.
 */
async function resetPassword(userId, password) {
  const user = await User.findByPk(userId);

  if (!user) {
    return { found: false };
  }

  await sequelize.transaction(async (transaction) => {
    user.password = password;
    await user.save({ transaction });
    await invalidateCodes(user.id, { transaction });
  });

  return { found: true };
}

module.exports = { requestPasswordReset, verifyResetCode, resetPassword };
