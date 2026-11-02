const { Router } = require("express");
const { toPublicImage } = require("./serializer");
const { loadImage } = require("./shared");
const { readAccess } = require("./guards");
const { imageRepository, SORT_FIELDS } = require("./repository");
const { parseListQuery } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

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
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial case-insensitive search }
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
  const query = parseListQuery(req.query, {
    sortFields: SORT_FIELDS,
    defaultOrder: [["id", "ASC"]],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const result = await imageRepository.list(
    { q: query.q },
    { pagination: query.pagination, order: query.order },
  );

  return sendListResponse(res, result, (image) => toPublicImage(image));
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
