const { Router } = require("express");
const { toPublicCity } = require("./serializer");
const { loadCity } = require("./shared");
const { readAccess } = require("./guards");
const { cityRepository } = require("./repository");
const { parseCityId, STATE_ID_MESSAGE } = require("./validators");

const router = Router();

/**
 * @openapi
 * /cities:
 *   get:
 *     summary: Lists cities; any authenticated user can do it
 *     description: >
 *       Returns cities ordered by id ascending. The optional `state_id` filter
 *       is exact; `include=state` nests the public state in every city.
 *     tags:
 *       - Cities
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
 *         name: include
 *         required: false
 *         schema:
 *           type: string
 *           enum: [state]
 *         example: state
 *     responses:
 *       200:
 *         description: Cities ordered by id ascending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/City'
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
 *         description: Invalid state_id filter
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
  const rawStateId = req.query.state_id;
  let stateId;

  if (rawStateId !== undefined) {
    stateId = parseCityId(rawStateId);

    if (stateId === null) {
      return res.status(422).json({ errors: { state_id: STATE_ID_MESSAGE } });
    }
  }

  const includeState = req.query.include === "state";
  const cities = await cityRepository.list({ stateId, includeState });

  return res.json(cities.map((city) => toPublicCity(city, { includeState })));
});

/**
 * @openapi
 * /cities/{id}:
 *   get:
 *     summary: Returns one city; any authenticated user can do it
 *     description: Returns the simple city contract without the nested state.
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
 *     responses:
 *       200:
 *         description: Public city data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
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
 *         description: The city does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: City not found
 *       422:
 *         description: Invalid city id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid city id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadCity, (req, res) =>
  res.json(toPublicCity(req.city)),
);

module.exports = router;
