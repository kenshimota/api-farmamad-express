const { Router } = require("express");
const { authenticate } = require("./middleware");
const { signToken } = require("./tokens");
const { toPublicUser } = require("./serializers");
const { MailDeliveryError } = require("./mailer");
const {
  requestPasswordReset,
  verifyResetCode,
  resetPassword,
} = require("./password-reset-service");
const { validateRequest } = require("./request-validator");
const {
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
} = require("./validators");

const router = Router();

const GENERIC_MESSAGE = "If the email exists, a recovery code was sent";
const INVALID_CODE_MESSAGE = "Invalid or expired code";
const COOLDOWN_MESSAGE = "Please wait before requesting a new code";
const MAIL_ERROR_MESSAGE = "Could not send the recovery email";
const UNAUTHORIZED_MESSAGE = "Unauthorized";
const FORGOT_FIELDS = ["email"];
const VERIFY_FIELDS = ["email", "code"];
const RESET_FIELDS = ["password", "passwordConfirmation"];

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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/forgot-password",
  validateRequest({ schema: forgotPasswordSchema, fields: FORGOT_FIELDS }),
  async (req, res, next) => {
    try {
      const { cooldown } = await requestPasswordReset(req.validated.email);

      if (cooldown) {
        return res.status(429).json({ message: COOLDOWN_MESSAGE });
      }

      return res.json({ message: GENERIC_MESSAGE });
    } catch (error) {
      if (error instanceof MailDeliveryError) {
        return res.status(502).json({ message: MAIL_ERROR_MESSAGE });
      }

      return next(error);
    }
  },
);

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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/verify-reset-code",
  validateRequest({ schema: verifyResetCodeSchema, fields: VERIFY_FIELDS }),
  async (req, res) => {
    const result = await verifyResetCode(
      req.validated.email,
      req.validated.code,
    );

    if (!result.valid) {
      return res.status(401).json({ message: INVALID_CODE_MESSAGE });
    }

    return res.json({
      token: signToken(result.user),
      user: toPublicUser(result.user),
    });
  },
);

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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/reset-password",
  authenticate,
  validateRequest({ schema: resetPasswordSchema, fields: RESET_FIELDS }),
  async (req, res) => {
    const result = await resetPassword(req.user.sub, req.validated.password);

    if (!result.found) {
      return res.status(401).json({ message: UNAUTHORIZED_MESSAGE });
    }

    return res.json({ message: "Password updated" });
  },
);

module.exports = router;
