const crypto = require("crypto");
const sequelize = require("../database");
const PasswordResetCode = require("../models/password-reset-code");
const { hashPassword, verifyPassword } = require("./password");
const clock = require("./clock");

const CODE_LENGTH = 8;
const CODE_TTL_MINUTES = 5;
const RESEND_COOLDOWN_MINUTES = 2;

const ISSUE_STATUS = Object.freeze({
  ISSUED: "issued",
  COOLDOWN: "cooldown",
});

const CONSUME_STATUS = Object.freeze({
  VALID: "valid",
  INVALID: "invalid",
});

/**
 * Converts minutes to milliseconds.
 * @param {number} minutes - Amount of minutes.
 * @returns {number} The equivalent in milliseconds.
 */
function minutesToMs(minutes) {
  return minutes * 60 * 1000;
}

/**
 * Generates a cryptographically secure 8-digit numeric code, keeping the
 * leading zeros (e.g. "00427193").
 * @returns {string} The generated code.
 */
function generateCode() {
  const value = crypto.randomInt(0, 10 ** CODE_LENGTH);

  return String(value).padStart(CODE_LENGTH, "0");
}

/**
 * Finds the most recent code of a user, optionally restricting the search to
 * codes that have not been consumed, and locks the row for update.
 * @param {number} userId - User primary key.
 * @param {object} options - Query options.
 * @param {import("sequelize").Transaction} options.transaction - Transaction.
 * @param {boolean} [options.pendingOnly] - Restrict to pending codes.
 * @returns {Promise<object|null>} The latest matching code, if any.
 */
function findLatestCode(userId, { transaction, pendingOnly = false }) {
  return PasswordResetCode.findOne({
    where: pendingOnly ? { userId, consumedAt: null } : { userId },
    order: [
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ],
    lock: transaction.LOCK.UPDATE,
    transaction,
  });
}

/**
 * Marks every pending code of a user as consumed.
 * @param {number} userId - User primary key.
 * @param {object} [options] - Sequelize options.
 * @param {import("sequelize").Transaction} [options.transaction] - Transaction.
 * @param {Date} [options.now] - Current date; defaults to the clock.
 * @returns {Promise<number[]>} Number of updated rows.
 */
async function invalidateCodes(
  userId,
  { transaction, now = clock.now() } = {},
) {
  return PasswordResetCode.update(
    { consumedAt: now },
    { where: { userId, consumedAt: null }, transaction },
  );
}

/**
 * Issues a new recovery code for a user. Previous valid codes are invalidated
 * inside the same transaction that creates the new one, and the resend
 * cooldown is enforced from the last issued code.
 * @param {number} userId - User primary key.
 * @param {object} [options] - Issuing options.
 * @param {(code: string) => Promise<void>} [options.sendCode] - Callback that
 *   delivers the plain code; it runs inside the transaction so a delivery
 *   failure rolls the new code back.
 * @param {Date} [options.now] - Current date; defaults to the clock.
 * @returns {Promise<{ status: string, code?: string }>} Issued code or cooldown.
 */
async function issueCode(userId, { sendCode, now = clock.now() } = {}) {
  return sequelize.transaction(async (transaction) => {
    const lastCode = await findLatestCode(userId, { transaction });

    if (
      lastCode &&
      now.getTime() - lastCode.createdAt.getTime() <
        minutesToMs(RESEND_COOLDOWN_MINUTES)
    ) {
      return { status: ISSUE_STATUS.COOLDOWN };
    }

    await invalidateCodes(userId, { transaction, now });

    const code = generateCode();
    const codeHash = await hashPassword(code);

    await PasswordResetCode.create(
      {
        userId,
        codeHash,
        expiresAt: new Date(now.getTime() + minutesToMs(CODE_TTL_MINUTES)),
        consumedAt: null,
      },
      { transaction },
    );

    if (sendCode) {
      await sendCode(code);
    }

    return { status: ISSUE_STATUS.ISSUED, code };
  });
}

/**
 * Validates and consumes the latest pending code of a user. A code that does
 * not exist, is expired or does not match the stored hash is rejected without
 * consuming it.
 * @param {number} userId - User primary key.
 * @param {string} code - Plain 8-digit code sent by the user.
 * @param {object} [options] - Consumption options.
 * @param {Date} [options.now] - Current date; defaults to the clock.
 * @returns {Promise<{ status: string }>} Whether the code was valid.
 */
async function consumeCode(userId, code, { now = clock.now() } = {}) {
  return sequelize.transaction(async (transaction) => {
    const resetCode = await findLatestCode(userId, {
      transaction,
      pendingOnly: true,
    });

    if (!resetCode || resetCode.expiresAt.getTime() <= now.getTime()) {
      return { status: CONSUME_STATUS.INVALID };
    }

    if (!(await verifyPassword(code, resetCode.codeHash))) {
      return { status: CONSUME_STATUS.INVALID };
    }

    resetCode.consumedAt = now;
    await resetCode.save({ transaction });

    return { status: CONSUME_STATUS.VALID };
  });
}

module.exports = {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  RESEND_COOLDOWN_MINUTES,
  ISSUE_STATUS,
  CONSUME_STATUS,
  generateCode,
  invalidateCodes,
  issueCode,
  consumeCode,
};
