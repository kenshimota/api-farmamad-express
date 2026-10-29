const { Router } = require("express");
const { toPublicSupplier } = require("./serializer");
const { loadSupplierWithLocation } = require("./shared");
const { readAccess } = require("./guards");
const { supplierRepository } = require("./repository");
const {
  CITY_ID_MESSAGE,
  STATE_ID_MESSAGE,
  parseSupplierId,
} = require("./validators");

const router = Router();

/**
 * @openapi
 * /suppliers:
 *   get:
 *     summary: Lists suppliers; any authenticated user can do it
 *     description: >
 *       Returns suppliers ordered by name with `city` and `state` nested. The
 *       optional `state_id` and `city_id` filters are exact; `q` searches
 *       partially and case-insensitively over name and identification.
 *     tags:
 *       - Suppliers
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: state_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 4
 *       - in: query
 *         name: city_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 10
 *       - in: query
 *         name: q
 *         required: false
 *         schema:
 *           type: string
 *         description: Partial term over name and identification
 *         example: salud
 *     responses:
 *       200:
 *         description: Suppliers ordered by name with their location nested
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid state_id or city_id filter
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 state_id: Invalid state
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  let stateId;
  let cityId;

  if (req.query.state_id !== undefined) {
    stateId = parseSupplierId(req.query.state_id);

    if (stateId === null) {
      return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
    }
  }

  if (req.query.city_id !== undefined) {
    cityId = parseSupplierId(req.query.city_id);

    if (cityId === null) {
      return res.status(422).json({ errors: { city_id: CITY_ID_MESSAGE } });
    }
  }

  const suppliers = await supplierRepository.list({
    stateId,
    cityId,
    q: req.query.q,
  });

  return res.json(
    suppliers.map((supplier) =>
      toPublicSupplier(supplier, { includeLocation: true }),
    ),
  );
});

/**
 * @openapi
 * /suppliers/{id}:
 *   get:
 *     summary: Returns one supplier; any authenticated user can do it
 *     description: Returns the supplier with `city` and `state` nested.
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
 *     responses:
 *       200:
 *         description: Public supplier data with its location nested
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Supplier'
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Blocked user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: User is blocked
 *       404:
 *         description: The supplier does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Supplier not found
 *       422:
 *         description: Invalid supplier id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid supplier id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadSupplierWithLocation, (req, res) =>
  res.json(toPublicSupplier(req.supplier, { includeLocation: true })),
);

module.exports = router;
