const { Router } = require("express");
const { writeAccess } = require("./guards");
const { inboxService } = require("./service");
const { toPublicInboxLot } = require("./serializer");
const { handleInboxError } = require("./errors");
const { parseLotId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /warehouse-inbox/lots/{id}/start:
 *   post:
 *     summary: Starts locating a lot; admin and manager_warehouse
 *     description: >
 *       Locks the lot with `FOR UPDATE`. A `pending` lot becomes
 *       `in_progress` and stores `location_started_at` and
 *       `location_started_by`. Starting again with the same user answers 200
 *       without changes; another user gets 409
 *       `Lot is being located by another user` and a located lot gets 409
 *       `Lot is already located`. Stock, reserved and the location are not
 *       modified.
 *     tags:
 *       - Warehouse inbox
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: Lot in progress
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/WarehouseInboxLot' }
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
 *         description: The lot does not exist
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       409:
 *         description: Lot already located or claimed by another user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       422:
 *         description: Invalid lot id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post("/lots/:id/start", ...writeAccess(), async (req, res) => {
  const id = parseLotId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid lot id" } });
  }

  try {
    const lot = await inboxService.startLot(id, req.user.sub);

    return res.json(toPublicInboxLot(lot, { userObjects: false }));
  } catch (error) {
    return handleInboxError(error, res);
  }
});

module.exports = router;
