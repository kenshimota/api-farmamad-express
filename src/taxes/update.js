const { Router } = require("express");
const { toPublicTax } = require("./serializer");
const { loadTax } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { UPDATE_TAX_FIELDS, updateTaxSchema } = require("./validators");
const { taxService } = require("./service");
const { handleTaxError } = require("./errors");

const router = Router();

/**
 * @openapi
 * /taxes/{id}:
 *   put:
 *     summary: Updates a tax; only administrators can do it
 *     description: >
 *       Updates `name`, `rate`, `description` and `is_active`; at least one of
 *       them is required. `code` is immutable and any value sent for it is
 *       ignored. A successful update responds 202 with the updated tax. No
 *       existing purchase or order is recalculated when the rate changes.
 *     tags:
 *       - Taxes
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
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Impuesto al Valor Agregado
 *               rate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 multipleOf: 0.01
 *                 example: 3.5
 *               description:
 *                 type: string
 *                 maxLength: 255
 *                 nullable: true
 *                 example: IVA general
 *               is_active: { type: boolean, example: false }
 *     responses:
 *       202:
 *         description: Updated public tax data
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Tax' }
 *       400:
 *         description: No editable field was provided
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
 *         description: The tax does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Tax not found }
 *       409:
 *         description: The code already exists
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Tax already exists }
 *       422:
 *         description: Invalid id or fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { rate: rate must be between 0 and 100 } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(updateTaxSchema, []),
  requireAnyField([...UPDATE_TAX_FIELDS], "At least one field is required"),
  loadTax,
  async (req, res) => {
    try {
      const tax = await taxService.updateTax(req.tax, req.validated);

      return res.status(202).json(toPublicTax(tax));
    } catch (error) {
      return handleTaxError(error, res);
    }
  },
);

module.exports = router;
