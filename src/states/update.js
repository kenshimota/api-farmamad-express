const { Router } = require("express");
const { toPublicState } = require("./serializer");
const { stateSchema } = require("./validators");
const { loadState, handleWriteError } = require("./shared");
const { requireAnyField, validatedBody, writeAccess } = require("./guards");
const { stateRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /states/{id}:
 *   put:
 *     summary: Updates a state; only administrators and sellers can do it
 *     description: >
 *       Accepts `name` and/or `code` (at least one) and responds 202 with the
 *       updated resource. The code is stored uppercase; names are unique
 *       ignoring case.
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
 *                 example: Aragua
 *               code:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 10
 *                 example: VE-D
 *     responses:
 *       202:
 *         description: Updated public state data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
 *       400:
 *         description: Neither name nor code was provided
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name or code is required
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
 *         description: The state does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: State not found
 *       409:
 *         description: The name or code belongs to another state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: State already exists
 *       422:
 *         description: Invalid state id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 name: Nombre inválido
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(stateSchema, []),
  requireAnyField(["name", "code"], "name or code is required"),
  loadState,
  async (req, res) => {
    try {
      await stateRepository.update(req.state, req.validated);

      return res.status(202).json(toPublicState(req.state));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
