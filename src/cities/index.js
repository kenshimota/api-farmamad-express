const { Router } = require("express");
const { toPublicCity } = require("./serializer");
const { citySchema } = require("./validators");
const { ensureState, handleWriteError } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { cityRepository } = require("./repository");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /cities:
 *   post:
 *     summary: Creates a city; only administrators and sellers can do it
 *     description: >
 *       `name` admits 2–100 characters; `state_id` must reference an existing
 *       state. The pair (name, state_id) is unique.
 *     tags:
 *       - Cities
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - state_id
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: Maracay
 *               state_id:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *     responses:
 *       201:
 *         description: City created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/City'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name and state_id are required
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
 *         description: The city already exists in that state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: City already exists
 *       422:
 *         description: Invalid fields or non-existent state
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
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(citySchema),
  ensureState,
  async (req, res) => {
    try {
      const city = await cityRepository.create(req.validated);

      return res.status(201).json(toPublicCity(city));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
