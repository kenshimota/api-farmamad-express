const { Router } = require("express");
const { toPublicState } = require("./serializer");
const { stateSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { stateRepository } = require("./repository");
const { handleWriteError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /states:
 *   post:
 *     summary: Creates a state; only administrators and sellers can do it
 *     description: >
 *       `name` is unique ignoring case and admits 2–100 characters; `code` is
 *       unique, admits 2–10 characters and is stored uppercase.
 *     tags:
 *       - States
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
 *               - code
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
 *       201:
 *         description: State created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/State'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: name and code are required
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
 *         description: The state name or code already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: State already exists
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 code: Código inválido
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(stateSchema),
  async (req, res) => {
    try {
      const state = await stateRepository.create(req.validated);

      return res.status(201).json(toPublicState(state));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
