const { Router } = require("express");
const { toPublicImage } = require("./serializer");
const { imageSchema } = require("./validators");
const { validatedBody, writeAccess } = require("./guards");
const { imageRepository } = require("./repository");
const { handleWriteError } = require("./shared");
const listRouter = require("./list");
const updateRouter = require("./update");
const removeRouter = require("./remove");

const router = Router();

/**
 * @openapi
 * /images:
 *   post:
 *     summary: Creates an image; only administrators and sellers can do it
 *     description: >
 *       Persists the metadata of a reusable image. `pathname` is optional: when
 *       it is omitted the image is assumed to live in S3 and it is stored as
 *       null. `reference` is unique and both `reference` and `pathname` are
 *       stored trimmed.
 *     tags:
 *       - Images
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *               - reference
 *               - thumbnail
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 maxLength: 2048
 *                 example: https://cdn.farmamad.com/products/ibuprofeno.png
 *               pathname:
 *                 type: string
 *                 maxLength: 2048
 *                 nullable: true
 *                 description: Optional local path; null when the image lives in S3
 *                 example: /uploads/products/ibuprofeno.png
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 description: Unique image reference; it is stored trimmed
 *                 example: ibuprofeno-400
 *               thumbnail:
 *                 type: string
 *                 format: uri
 *                 maxLength: 2048
 *                 example: https://cdn.farmamad.com/products/ibuprofeno-thumb.png
 *     responses:
 *       201:
 *         description: Image created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
 *       400:
 *         description: Missing required fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: url, reference and thumbnail are required
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
 *         description: The image reference already exists
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Image already exists
 *       422:
 *         description: Invalid fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 url: URL inválida
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post(
  "/",
  ...writeAccess(),
  ...validatedBody(imageSchema),
  async (req, res) => {
    try {
      const image = await imageRepository.create(req.validated);

      return res.status(201).json(toPublicImage(image));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

router.use(listRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
