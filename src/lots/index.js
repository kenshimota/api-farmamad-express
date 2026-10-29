const { Router } = require("express");
const { toPublicLot } = require("./serializer");
const { createLotSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { lotService } = require("./service");
const { handleWriteError } = require("./errors");
const listRouter = require("./list");
const detailRouter = require("./detail");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /lots:
 *   post:
 *     summary: Creates a lot; admin, seller and manager_warehouse
 *     description: >
 *       `number`, `product_id`, `expiration_date`, `item_state_id`,
 *       `warehouse_id`, `shelf_id` and `section_id` are required; `stock` and
 *       `reserved` default to 0. References must exist and the shelf must
 *       belong to the warehouse while the section must belong to the shelf.
 *       `(product_id, number)` is unique ignoring case. The response includes
 *       `available = stock - reserved` and the nested relations.
 *     tags:
 *       - Lots
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - number
 *               - product_id
 *               - expiration_date
 *               - item_state_id
 *               - warehouse_id
 *               - shelf_id
 *               - section_id
 *             properties:
 *               number: { type: string, maxLength: 100, example: L-2026-001 }
 *               product_id: { type: integer, minimum: 1, example: 15 }
 *               expiration_date: { type: string, format: date, example: '2027-03-31' }
 *               item_state_id: { type: integer, minimum: 1, example: 1 }
 *               stock: { type: integer, minimum: 0, maximum: 1000000000, example: 120 }
 *               reserved: { type: integer, minimum: 0, maximum: 1000000000, example: 15 }
 *               warehouse_id: { type: integer, minimum: 1, example: 1 }
 *               shelf_id: { type: integer, minimum: 1, example: 1 }
 *               section_id: { type: integer, minimum: 1, example: 2 }
 *     responses:
 *       201:
 *         description: Lot created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Lot' }
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example:
 *               message: number, product_id, expiration_date, item_state_id, warehouse_id, shelf_id and section_id are required
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
 *         $ref: '#/components/responses/NotFound'
 *       409:
 *         description: The product already has that lot number
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Lot already exists }
 *       422:
 *         description: Invalid fields, references, location or quantities
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { shelf_id: Shelf does not belong to the warehouse } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(createLotSchema),
  async (req, res) => {
    try {
      const lot = await lotService.createLot(req.validated);

      return res.status(201).json(toPublicLot(lot));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(detailRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
