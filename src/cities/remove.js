const { Router } = require("express");
const { loadCity, handleDeleteError } = require("./shared");
const { writeAccess } = require("./guards");
const { cityRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /cities/{id}:
 *   delete:
 *     summary: Deletes a city permanently; only administrators and sellers can do it
 *     description: >
 *       A city referenced by a supplier cannot be removed: it responds 409
 *       with `City is in use` and stays in the database.
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
 *       204:
 *         description: City deleted; the response has no body
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
 *         description: A supplier references the city
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: City is in use
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
router.delete("/:id", ...writeAccess(), loadCity, async (req, res) => {
  try {
    await cityRepository.remove(req.city);

    return res.status(204).send();
  } catch (error) {
    return handleDeleteError(error, res);
  }
});

module.exports = router;
