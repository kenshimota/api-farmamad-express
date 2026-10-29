const { Router } = require("express");
const { toPublicState } = require("./serializer");
const { loadState } = require("./shared");
const { readAccess } = require("./guards");
const { stateRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /states:
 *   get:
 *     summary: Lists every state; any authenticated user can do it
 *     description: Returns every state ordered by name ascending with public fields only.
 *     tags:
 *       - States
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: States ordered by name ascending
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/State'
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
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const states = await stateRepository.list();

  return res.json(states.map((state) => toPublicState(state)));
});

/**
 * @openapi
 * /states/{id}:
 *   get:
 *     summary: Returns one state; any authenticated user can do it
 *     tags:
 *       - States
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
 *         description: Public state data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
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
 *         description: The state does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: State not found
 *       422:
 *         description: Invalid state id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid state id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadState, (req, res) =>
  res.json(toPublicState(req.state)),
);

module.exports = router;
