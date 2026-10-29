const { Router } = require("express");
const { toPublicCity } = require("./serializer");
const { citySchema } = require("./validators");
const { ensureState, handleWriteError, loadCity } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { cityRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /cities/{id}:
 *   put:
 *     summary: Updates a city; only administrators and sellers can do it
 *     description: >
 *       Accepts `name` and/or `state_id` (at least one) and responds 202 with
 *       the updated resource. The new state must exist.
 *     tags:
 *       - Cities
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 10
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
 *                 example: Turmero
 *               state_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *     responses:
 *       202:
 *         description: Updated public city data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       400:
 *         description: Neither name nor state_id was provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name or state_id is required
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
 *         description: The city does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: City not found
 *       409:
 *         description: The city name already exists in the target state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: City already exists
 *       422:
 *         description: Invalid city id, invalid fields or missing state
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
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(citySchema, []),
  requireAnyField(["name", "state_id"], "name or state_id is required"),
  ensureState,
  loadCity,
  async (req, res) => {
    try {
      await cityRepository.update(req.city, req.validated);

      return res.status(202).json(toPublicCity(req.city));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
