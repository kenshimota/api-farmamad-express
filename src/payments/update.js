const { Router } = require("express");
const { authenticate } = require("../auth/middleware");
const { authorize } = require("../auth/authorize");
const { validateRequest } = require("../auth/request-validator");
const { PAYMENT_UPDATE_FIELDS } = require("./fields");
const { updatePaymentSchema } = require("./validators");
const { toPublicPayment } = require("./serializer");
const { paymentService } = require("./service");
const { handlePaymentError } = require("./errors");
const { loadPayment } = require("./shared");
const { uploadSingleImage } = require("../products/upload");

const router = Router();

/**
 * Middleware that rejects an empty update payload after validation.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {void}
 */
function requireAnyUpdateField(req, res, next) {
  const present =
    Boolean(req.file) ||
    PAYMENT_UPDATE_FIELDS.some((field) => req.validated[field] !== undefined);

  if (!present) {
    return res.status(400).json({ message: "At least one field is required" });
  }

  return next();
}

/**
 * @openapi
 * /payments/{id}:
 *   put:
 *     summary: Updates the metadata and reference image of a payment; admin and seller
 *     description: >
 *       Only `reference`, `notes` and `paid_at` are editable. `customer_id`,
 *       `method_payment_id`, `currency_id` and `amount` are immutable: sending
 *       another value answers 422. Accepts JSON or multipart/form-data; a new
 *       `image` replaces `reference_image_id` while the previous image row and
 *       files stay for audit. `image_id` and `reference_image_id` are never
 *       accepted in the body. A payment with invoice allocations answers 409.
 *       A successful update responds 202.
 *     tags:
 *       - Payments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reference: { type: string, maxLength: 100 }
 *               notes: { type: string, maxLength: 1000 }
 *               paid_at: { type: string, format: date-time }
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               reference: { type: string, maxLength: 100 }
 *               notes: { type: string, maxLength: 1000 }
 *               paid_at: { type: string, format: date-time }
 *               image: { type: string, format: binary }
 *     responses:
 *       202:
 *         description: Updated payment
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Payment' }
 *       400:
 *         description: No field was provided
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: At least one field is required }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: The payment does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: The payment has invoice allocations
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Payment has allocations }
 *       413:
 *         description: The image exceeds 5 MB
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid field, immutable value or invalid image
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  authenticate,
  authorize("admin", "seller"),
  uploadSingleImage,
  validateRequest({ schema: updatePaymentSchema, fields: [] }),
  requireAnyUpdateField,
  loadPayment,
  async (req, res) => {
    try {
      const payment = req.file
        ? await paymentService.updatePayment(req.payment, req.validated, {
            file: req.file,
          })
        : await paymentService.updatePayment(req.payment, req.validated);

      return res.status(202).json(toPublicPayment(payment));
    } catch (error) {
      return handlePaymentError(error, res);
    }
  },
);

module.exports = router;
