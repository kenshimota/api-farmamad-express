const { Router } = require("express");
const { loadState, handleDeleteError } = require("./shared");
const { writeAccess } = require("./guards");
const { stateRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /states/{id}:
 *   delete:
 *     summary: Deletes a state permanently; only administrators and sellers can do it
 *     description: >
 *       A state with cities cannot be removed: it responds 409 with
 *       `State has cities` and stays in the database.
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
 *       204:
 *         description: State deleted; the response has no body
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
 *         description: The state has cities
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: State has cities
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
router.delete("/:id", ...writeAccess(), loadState, async (req, res) => {
  try {
    await stateRepository.remove(req.state);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
