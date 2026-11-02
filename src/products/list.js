const { Router } = require("express");
const { toPublicProduct } = require("./serializer");
const { loadProduct } = require("./shared");
const { readAccess } = require("./guards");
const { productRepository, SORT_FIELDS } = require("./repository");
const { parsePositiveInteger } = require("../shared/parsers");
const { parseListQuery, parseNonEmptyString } = require("../shared/list-query");
const { sendListResponse } = require("../shared/pagination");

const router = Router();

const FILTER_SPECS = Object.freeze([
  {
    query: "category_id",
    field: "categoryId",
    parse: parsePositiveInteger,
    message: "Invalid category_id",
  },
  {
    query: "tax_id",
    field: "taxId",
    parse: parsePositiveInteger,
    message: "Invalid tax_id",
  },
  {
    query: "image_id",
    field: "imageId",
    parse: parsePositiveInteger,
    message: "Invalid image_id",
  },
  {
    query: "reference",
    field: "reference",
    parse: parseNonEmptyString,
    message: "Invalid reference",
  },
]);

/**
 * @openapi
 * /products:
 *   get:
 *     summary: Lists products; any authenticated user can do it
 *     description: >
 *       Without `page` or `page_size` the response is the flat array ordered
 *       by id ascending, preserving the historical contract. Sending either
 *       parameter opts into the paginated `{ data, meta }` envelope. `q`
 *       searches partially and case-insensitively over name, description and
 *       reference, so `?q=ibu&page_size=10` works as the autocomplete query.
 *     tags:
 *       - Products
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - { in: query, name: page, schema: { type: integer, minimum: 1, default: 1 } }
 *       - { in: query, name: page_size, schema: { type: integer, minimum: 1, maximum: 100, default: 20 } }
 *       - { in: query, name: sort, schema: { type: string, enum: [id, name, reference, category_id, tax_id] } }
 *       - { in: query, name: order, schema: { type: string, enum: [asc, desc], default: asc } }
 *       - { in: query, name: q, schema: { type: string }, description: Partial search over name, description and reference }
 *       - { in: query, name: category_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: tax_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: image_id, schema: { type: integer, minimum: 1 } }
 *       - { in: query, name: reference, schema: { type: string }, description: Partial reference filter }
 *     responses:
 *       200:
 *         description: Flat array without pagination, or the { data, meta } envelope when page/page_size is sent
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: array
 *                   items: { $ref: '#/components/schemas/Product' }
 *                 - $ref: '#/components/schemas/PaginatedResponse'
 *             examples:
 *               autocomplete:
 *                 value:
 *                   data:
 *                     - { id: 12, name: Ibuprofeno 400 mg, description: Analgésico y antiinflamatorio, reference: IBU-400, category_id: 3, image_id: 5, tax_id: 1 }
 *                   meta: { page: 1, page_size: 10, total: 1, total_pages: 1, has_next: false, has_prev: false }
 *               flat:
 *                 value:
 *                   - { id: 12, name: Ibuprofeno 400 mg, description: Analgésico y antiinflamatorio, reference: IBU-400, category_id: 3, image_id: 5, tax_id: 1 }
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
 *       422:
 *         description: Invalid page, page_size, sort, order, q or filter
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { page: Invalid page } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", ...readAccess(), async (req, res) => {
  const query = parseListQuery(req.query, {
    filters: FILTER_SPECS,
    sortFields: SORT_FIELDS,
    defaultOrder: [["id", "ASC"]],
  });

  if (query.errors) {
    return res.status(422).json({ errors: query.errors });
  }

  const result = await productRepository.list(
    { ...query.filters, q: query.q },
    { pagination: query.pagination, order: query.order },
  );

  return sendListResponse(res, result, (product) => toPublicProduct(product));
});

/**
 * @openapi
 * /products/{id}:
 *   get:
 *     summary: Returns one product; any authenticated user can do it
 *     tags:
 *       - Products
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
 *         description: Public product data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
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
 *         description: The product does not exist
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Product not found
 *       422:
 *         description: Invalid product id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid product id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...readAccess(), loadProduct, (req, res) =>
  res.json(toPublicProduct(req.product)),
);

module.exports = router;
