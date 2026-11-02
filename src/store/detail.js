const { Router } = require("express");
const { createHttpError } = require("../shared/http-error");
const { readField } = require("../shared/serializer");
const {
  handleStoreError,
  readAccess,
  resolveStoreCustomer,
} = require("./guards");
const { resolveCatalogPrice } = require("./pricing");
const { storeRepository } = require("./repository");
const { toStoreDetailVariant, toStoreProductDetail } = require("./serializer");
const {
  INVALID_ITEM_STATE_ID_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  INVALID_PRODUCT_ID_MESSAGE,
  parseItemStateId,
  parseProductId,
} = require("./validators");

const PRODUCT_NOT_FOUND_MESSAGE = "Product not found";
const router = Router();

/**
 * Loads one product and every sellable item state that has a resolvable price.
 * Out-of-stock variants are kept with `available: false`, unlike the listing.
 * @param {object} params - Detail inputs.
 * @param {object} params.repository - Store repository.
 * @param {number} params.productId - Product id.
 * @param {object} params.priceList - Customer price list with `percentage`.
 * @param {number} [params.itemStateId] - Optional sellable item state filter.
 * @returns {Promise<object>} Public product detail.
 * @throws {Error} 404 when the product does not exist or has no priced variant.
 */
async function getProductDetail({
  repository = storeRepository,
  productId,
  priceList,
  itemStateId,
}) {
  const transactionCurrency = await repository.findDefaultCurrency();
  const costs = await repository.findCosts({ productId, itemStateId });

  if (costs.length === 0) {
    throw createHttpError(404, { message: PRODUCT_NOT_FOUND_MESSAGE });
  }

  const product = readField(costs[0], "product");
  const itemStateIds = [
    ...new Set(costs.map((cost) => Number(readField(cost, "item_state_id")))),
  ];
  const availability = await repository.findAvailability({
    productIds: [productId],
    itemStateIds,
  });
  const percentage = readField(priceList, "percentage");
  const variants = [];

  for (const cost of costs) {
    const itemState = readField(cost, "item_state");

    if (!itemState || readField(itemState, "is_sellable") === false) {
      continue;
    }

    const price = resolveCatalogPrice({
      cost: readField(cost, "cost"),
      costCurrency: readField(cost, "currency"),
      transactionCurrency,
      percentage,
    });

    if (price === null) {
      continue;
    }

    const key = `${Number(readField(cost, "product_id"))}:${Number(
      readField(cost, "item_state_id"),
    )}`;
    const lots = availability[key];

    variants.push(
      toStoreDetailVariant({
        itemState,
        price,
        currency: transactionCurrency,
        available: Boolean(lots && lots.available),
      }),
    );
  }

  if (variants.length === 0) {
    throw createHttpError(404, { message: PRODUCT_NOT_FOUND_MESSAGE });
  }

  return toStoreProductDetail(product, variants);
}

/**
 * Builds the Express handler for the product detail.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Store repository.
 * @param {Function} [dependencies.resolveCustomer] - Customer access guard.
 * @param {Function} [dependencies.loadDetail] - Product detail loader.
 * @returns {import("express").RequestHandler} The detail handler.
 */
function createDetailHandler({
  repository = storeRepository,
  resolveCustomer = resolveStoreCustomer,
  loadDetail = getProductDetail,
} = {}) {
  return async function productDetail(req, res) {
    try {
      const productId = parseProductId(req.params.id);

      if (productId === null) {
        return res.status(422).json({
          errors: { id: INVALID_PRODUCT_ID_MESSAGE },
        });
      }

      const rawItemStateId = req.query.item_state_id;
      let itemStateId;

      if (rawItemStateId !== undefined) {
        itemStateId = parseItemStateId(rawItemStateId);

        if (itemStateId === null) {
          return res.status(422).json({
            errors: { item_state_id: INVALID_ITEM_STATE_ID_MESSAGE },
          });
        }
      }

      const context = await resolveCustomer({
        user: req.currentUser,
        requestedCustomerId: req.query.customer_id,
        repository,
      });

      if (itemStateId !== undefined) {
        const itemState = await repository.findItemState(itemStateId);

        if (!itemState || !readField(itemState, "is_sellable")) {
          return res.status(422).json({
            errors: { item_state_id: INVALID_ITEM_STATE_MESSAGE },
          });
        }
      }

      const detail = await loadDetail({
        repository,
        productId,
        priceList: context.priceList,
        itemStateId,
      });

      return res.json(detail);
    } catch (error) {
      return handleStoreError(error, res);
    }
  };
}

/**
 * @openapi
 * /store/products/{id}:
 *   get:
 *     summary: Returns one product with its priced variants; allowed to customer, admin and seller
 *     description: >
 *       Applies the same customer and price list rules as the listing. Each
 *       variant carries the item state, the resolved price, the active default
 *       transaction currency and `available`, calculated from
 *       `SUM(lots.stock - lots.reserved)`. Variants with a resolvable price but
 *       no stock are returned with `available: false`; the listing hides them.
 *       `item_state_id` limits `variants` to one sellable state.
 *     tags:
 *       - Store
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 15
 *       - in: query
 *         name: customer_id
 *         required: false
 *         description: Required for admin and seller; forbidden for customer.
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 8
 *       - in: query
 *         name: item_state_id
 *         required: false
 *         schema:
 *           type: integer
 *           minimum: 1
 *         example: 1
 *     responses:
 *       200:
 *         description: Product fields and its priced variants
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StoreProductDetail'
 *       400:
 *         description: Staff request without customer_id
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: customer_id is required
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Unauthorized
 *       403:
 *         description: Role without permission, blocked user, unlinked customer, customer without price list or seller not assigned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *       404:
 *         description: Product missing or without any variant with a resolvable price
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 *             example:
 *               message: Product not found
 *       422:
 *         description: Invalid product id, invalid item_state_id or non-sellable state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 id: Invalid product id
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       503:
 *         description: No active default transaction currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.get("/:id", ...readAccess(), createDetailHandler());

module.exports = router;
module.exports.createDetailHandler = createDetailHandler;
module.exports.getProductDetail = getProductDetail;
