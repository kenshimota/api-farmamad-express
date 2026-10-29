const { Router } = require("express");
const { toPublicImage } = require("./serializer");
const { loadImage } = require("./shared");
const { readAccess } = require("./guards");
const { imageRepository } = require("./repository");

const router = Router();

/**
 * @openapi
 * /images:
 *   get:
 *     summary: Lists every image; any authenticated user can do it
 *     description: >
 *       Returns every image ordered by id ascending with public fields only.
 *       When there are no images it responds 200 with an empty array.
 *     tags:
 *       - Images
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Images ordered by id ascending with public fields only
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Image'
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
  const images = await imageRepository.list();

  return res.json(images.map((image) => toPublicImage(image)));
});

/**
 * @openapi
 * /images/{id}:
 *   get:
 *     summary: Returns one image; any authenticated user can do it
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
 *     responses:
 *       200:
 *         description: Public image data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Image'
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
 *         description: The image does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Image not found
 *       422:
 *         description: Invalid image id
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
router.get("/:id", ...readAccess(), loadImage, (req, res) =>
  res.json(toPublicImage(req.image)),
);

module.exports = router;
