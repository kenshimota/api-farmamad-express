const { Router } = require("express");
const { toPublicSupplier } = require("./serializer");
const { supplierSchema } = require("./validators");
const { ensureLocation, handleWriteError } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { supplierRepository } = require("./repository");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /suppliers:
 *   post:
 *     summary: Creates a supplier; only administrators and sellers can do it
 *     description: >
 *       `identification` is unique ignoring case, stored uppercase and kept as
 *       text; `email` is required but not unique and is stored lowercase. The
 *       city must exist and belong to the indicated state. Send
 *       `?include=location` to nest `city` and `state` in the response.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: include
 *         required: false
 *         schema:
 *           type: string
 *           enum: [location]
 *         example: location
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - identification
 *               - email
 *               - phone
 *               - address
 *               - city_id
 *               - state_id
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 150
 *                 example: Distribuidora La Salud C.A.
 *               identification:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 30
 *                 description: Unique ignoring case; stored uppercase
 *                 example: J-12345678-9
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 150
 *                 example: ventas@lasalud.com
 *               phone:
 *                 type: string
 *                 minLength: 7
 *                 maxLength: 30
 *                 example: +58 212 555-1234
 *               observations:
 *                 type: string
 *                 maxLength: 1000
 *                 nullable: true
 *                 example: Entrega los martes
 *               address:
 *                 type: string
 *                 minLength: 5
 *                 maxLength: 255
 *                 example: Av. Principal, Galpón 4
 *               city_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 10
 *               state_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *     responses:
 *       201:
 *         description: Supplier created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name, identification, email, phone, address, city_id and state_id are required
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The identification already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier already exists
 *       422:
 *         description: Invalid fields, missing location or incoherent city/state
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
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(supplierSchema),
  ensureLocation,
  async (req, res) => {
    try {
      const created = await supplierRepository.create(req.validated);
      const includeLocation = req.query.include === "location";
      const supplier = includeLocation
        ? await supplierRepository.findById(created.id, { includeLocation })
        : created;

      return res
        .status(201)
        .json(toPublicSupplier(supplier, { includeLocation }));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
