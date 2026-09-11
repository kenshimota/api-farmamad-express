const { Router } = require("express");
const User = require("../models/user");
const Role = require("../models/role");
const sequelize = require("../database");
const { authenticate } = require("./middleware");
const { signToken } = require("./tokens");
const { toPublicUser } = require("./serializers");
const {
  ISSUE_STATUS,
  CONSUME_STATUS,
  issueCode,
  consumeCode,
  invalidateCodes,
} = require("./recovery-codes");
const { sendRecoveryCode, MailDeliveryError } = require("./mailer");
const {
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
  formatValidationErrors,
  missingFields,
  requiredFieldsMessage,
} = require("./validators");

const router = Router();

const GENERIC_MESSAGE = "If the email exists, a recovery code was sent";
const INVALID_CODE_MESSAGE = "Invalid or expired code";
const COOLDOWN_MESSAGE = "Please wait before requesting a new code";
const MAIL_ERROR_MESSAGE = "Could not send the recovery email";
const FORGOT_FIELDS = ["email"];
const VERIFY_FIELDS = ["email", "code"];
const RESET_FIELDS = ["password", "passwordConfirmation"];

/**
 * Validates the body, answering 400 when required fields are missing and 422
 * when a field has an invalid format. The 400 message always lists every
 * required field, matching the API contract.
 * @param {import("express").Response} res - Express response.
 * @param {object} body - Request body.
 * @param {string[]} fields - Required field names.
 * @param {import("yup").Schema} schema - Schema with the format rules.
 * @returns {Promise<object|null>} Validated data, or null when it responded.
 */
async function validateBody(res, body, fields, schema) {
  if (missingFields(body, fields).length) {
    res.status(400).json({ message: requiredFieldsMessage(fields) });
    return null;
  }

  try {
    return await schema.validate(body, {
      abortEarly: false,
      stripUnknown: true,
    });
  } catch (error) {
    res.status(422).json({ errors: formatValidationErrors(error) });
    return null;
  }
}

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Sends a password recovery code by email when the account exists
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email, example: juan@example.com }
 *     responses:
 *       200:
 *         description: Generic response, identical whether the email exists or not
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: 'If the email exists, a recovery code was sent' }
 *       400:
 *         description: Missing email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: email is required }
 *       422:
 *         description: Invalid email
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { email: Email inválido } }
 *       429:
 *         description: The 2 minute resend cooldown is still active
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Please wait before requesting a new code }
 *       502:
 *         description: The email could not be sent and no code was persisted
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Could not send the recovery email }
 */
router.post("/forgot-password", async (req, res) => {
  const body = req.body ?? {};
  const data = await validateBody(
    res,
    body,
    FORGOT_FIELDS,
    forgotPasswordSchema,
  );

  if (!data) {
    return undefined;
  }

  const user = await User.findOne({ where: { email: data.email } });

  if (!user) {
    return res.json({ message: GENERIC_MESSAGE });
  }

  let result;
  try {
    result = await issueCode(user.id, {
      sendCode: (code) => sendRecoveryCode(user.email, code),
    });
  } catch (error) {
    if (error instanceof MailDeliveryError) {
      return res.status(502).json({ message: MAIL_ERROR_MESSAGE });
    }

    throw error;
  }

  if (result.status === ISSUE_STATUS.COOLDOWN) {
    return res.status(429).json({ message: COOLDOWN_MESSAGE });
  }

  return res.json({ message: GENERIC_MESSAGE });
});

/**
 * @openapi
 * /auth/verify-reset-code:
 *   post:
 *     summary: Validates a recovery code and returns a JWT for the user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, code]
 *             properties:
 *               email: { type: string, format: email, example: juan@example.com }
 *               code: { type: string, pattern: '^\d{8}$', example: '00427193' }
 *     responses:
 *       200:
 *         description: Valid code; the session starts immediately
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/TokenResponse' }
 *       400:
 *         description: Missing email or code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: email and code are required }
 *       401:
 *         description: Invalid, expired or already used code
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Invalid or expired code }
 *       422:
 *         description: Invalid email or code format
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { code: El código debe tener 8 dígitos } }
 */
router.post("/verify-reset-code", async (req, res) => {
  const body = req.body ?? {};
  const data = await validateBody(
    res,
    body,
    VERIFY_FIELDS,
    verifyResetCodeSchema,
  );

  if (!data) {
    return undefined;
  }

  const user = await User.findOne({
    where: { email: data.email },
    include: { model: Role, as: "role" },
  });

  if (!user) {
    return res.status(401).json({ message: INVALID_CODE_MESSAGE });
  }

  const result = await consumeCode(user.id, data.code);

  if (result.status !== CONSUME_STATUS.VALID) {
    return res.status(401).json({ message: INVALID_CODE_MESSAGE });
  }

  return res.json({ token: signToken(user), user: toPublicUser(user) });
});

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Updates the password of the authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, passwordConfirmation]
 *             properties:
 *               password: { type: string, format: password, minLength: 8, example: nuevaClave123 }
 *               passwordConfirmation: { type: string, format: password, minLength: 8, example: nuevaClave123 }
 *     responses:
 *       200:
 *         description: Password updated; every pending recovery code was invalidated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Password updated }
 *       400:
 *         description: Missing password or passwordConfirmation
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: password and passwordConfirmation are required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Unauthorized }
 *       422:
 *         description: Password too short or confirmation mismatch
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { passwordConfirmation: Passwords do not match } }
 */
router.post("/reset-password", authenticate, async (req, res) => {
  const body = req.body ?? {};
  const data = await validateBody(res, body, RESET_FIELDS, resetPasswordSchema);

  if (!data) {
    return undefined;
  }

  const user = await User.findByPk(req.user.sub);

  if (!user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  await sequelize.transaction(async (transaction) => {
    user.password = data.password;
    await user.save({ transaction });
    await invalidateCodes(user.id, { transaction });
  });

  return res.json({ message: "Password updated" });
});

module.exports = router;
