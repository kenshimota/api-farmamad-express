const { Router } = require("express");
const { toPublicSupplier } = require("./serializer");
const { supplierSchema } = require("./validators");
const { ensureLocation, handleWriteError, loadSupplier } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { supplierRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /suppliers/{id}:
 *   put:
 *     summary: Updates a supplier; only administrators and sellers can do it
 *     description: >
 *       Accepts any editable field and at least one is required. When only
 *       `city_id` changes, `state_id` is derived from the new city; when both
 *       are sent they must be coherent. The identification remains unique
 *       ignoring case. A successful update responds 202 Accepted.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
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
 *                 maxLength: 150
 *                 example: Distribuidora Central
 *               identification:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 30
 *                 example: J-99999999-9
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 150
 *                 example: nuevo@lasalud.com
 *               phone:
 *                 type: string
 *                 minLength: 7
 *                 maxLength: 30
 *                 example: +58 212 555-0000
 *               observations:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: Entrega los jueves
 *               address:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 255
 *                 example: Calle 3 #10
 *               city_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 10
 *               state_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *     responses:
 *       202:
 *         description: Updated public supplier data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: No editable field was provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: At least one field is required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission or blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Forbidden
 *       404:
 *         description: The supplier does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier not found
 *       409:
 *         description: The identification belongs to another supplier
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier already exists
 *       422:
 *         description: Invalid supplier id, fields or location
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 city_id: City does not belong to state
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(supplierSchema, []),
  requireAnyField(),
  loadSupplier,
  ensureLocation,
  async (req, res) => {
    try {
      await supplierRepository.update(req.supplier, req.validated);

      return res.status(202).json(toPublicSupplier(req.supplier));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
