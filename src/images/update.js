const { Router } = require("express");
const { toPublicImage } = require("./serializer");
const { imageSchema } = require("./validators");
const { loadImage, handleWriteError } = require("./shared");
const { validatedBody, writeAccess } = require("./guards");
const { imageRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /images/{id}:
 *   put:
 *     summary: Updates an image; only administrators and sellers can do it
 *     description: >
 *       Replaces the resource and requires `url`, `reference` and `thumbnail`.
 *       `pathname` is optional and, when omitted, it is stored as null. As with
 *       every PUT endpoint, a successful update responds 202 Accepted with the
 *       updated resource in the body.
 *     tags:
 *       - Images
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
 *                 example: /uploads/products/ibuprofeno.png
 *               reference:
 *                 type: string
 *                 maxLength: 100
 *                 example: ibuprofeno-400
 *               thumbnail:
 *                 type: string
 *                 format: uri
 *                 maxLength: 2048
 *                 example: https://cdn.farmamad.com/products/ibuprofeno-thumb.png
 *     responses:
 *       202:
 *         description: Updated public image data
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
 *         description: The image does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Image not found
 *       409:
 *         description: The image reference belongs to another image
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Image already exists
 *       422:
 *         description: Invalid image id or fields
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid image id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put(
  "/:id",
  ...writeAccess(),
  ...validatedBody(imageSchema),
  loadImage,
  async (req, res) => {
    try {
      await imageRepository.update(req.image, req.validated);

      return res.status(202).json(toPublicImage(req.image));
    } catch (error) {
      return handleWriteError(error, res);
    }
  },
);

module.exports = router;
