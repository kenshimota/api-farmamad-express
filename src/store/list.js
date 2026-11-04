const { Router } = require("express");
const { readField } = require("../shared/serializer");
const {
  handleStoreError,
  readAccess,
  resolveStoreCustomer,
} = require("./guards");
const { resolveCatalogPrice } = require("./pricing");
const { storeRepository } = require("./repository");
const { toStoreListVariant } = require("./serializer");
const {
  INVALID_ITEM_STATE_ID_MESSAGE,
  INVALID_ITEM_STATE_MESSAGE,
  parseItemStateId,
} = require("./validators");

const router = Router();

/**
 * Builds the catalog listing from already joined cost rows, one lot aggregate
 * query and one stock control query. It never calls the pricing resolver per
 * variant and never returns duplicated rows.
 * @param {object} params - Catalog inputs.
 * @param {object} params.repository - Store repository.
 * @param {object} params.priceList - Customer price list with `percentage`.
 * @param {number} [params.itemStateId] - Optional sellable item state filter.
 * @returns {Promise<object[]>} Public listing entries.
 */
async function listCatalog({
  repository = storeRepository,
  priceList,
  itemStateId,
}) {
  const transactionCurrency = await repository.findDefaultCurrency();
  const costs = await repository.findCosts({ itemStateId });

  if (costs.length === 0) {
    return [];
  }

  const productIds = [
    ...new Set(costs.map((cost) => Number(readField(cost, "product_id")))),
  ];
  const itemStateIds = [
    ...new Set(costs.map((cost) => Number(readField(cost, "item_state_id")))),
  ];
  const [availability, quantities] = await Promise.all([
    repository.findAvailability({ productIds, itemStateIds }),
    repository.findStockQuantities({ productIds, itemStateIds }),
  ]);
  const percentage = readField(priceList, "percentage");
  const variants = [];

  for (const cost of costs) {
    const productId = Number(readField(cost, "product_id"));
    const itemStateIdOfCost = Number(readField(cost, "item_state_id"));
    const key = `${productId}:${itemStateIdOfCost}`;
    const lots = availability[key];
    const quantity = quantities[key];

    if (
      !lots ||
      !lots.available ||
      quantity === undefined ||
      quantity !== lots.stock
    ) {
      continue;
    }

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

    variants.push(
      toStoreListVariant({
        product: readField(cost, "product"),
        itemState,
        price,
        tax: readField(readField(cost, "product"), "tax"),
        currency: transactionCurrency,
        available: true,
      }),
    );
  }

  return variants;
}

/**
 * Builds the Express handler for the catalog listing.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Store repository.
 * @param {Function} [dependencies.resolveCustomer] - Customer access guard.
 * @param {Function} [dependencies.loadCatalog] - Catalog loader.
 * @returns {import("express").RequestHandler} The listing handler.
 */
function createListHandler({
  repository = storeRepository,
  resolveCustomer = resolveStoreCustomer,
  loadCatalog = listCatalog,
} = {}) {
  return async function listProducts(req, res) {
    try {
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

      const variants = await loadCatalog({
        repository,
        priceList: context.priceList,
        itemStateId,
      });

      return res.json(variants);
    } catch (error) {
      return handleStoreError(error, res);
    }
  };
}

/**
 * @openapi
 * /store/products:
 *   get:
 *     summary: Lists the customer store catalog; allowed to customer, admin and seller
 *     description: >
 *       Returns one entry per product + sellable item state whose price can be
 *       resolved from the customer price list and whose lots have
 *       `stock - reserved > 0`. The price comes from the margin formula in
 *       `src/pricing/` and never from `products.sale_price`. `customer` uses its
 *       own linked profile; `admin` and `seller` must send `customer_id`, and a
 *       seller only sees assigned customers. `item_state_id` is optional and
 *       must reference a sellable item state.
 *     tags:
 *       - Store
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *         description: One entry per available product + item state variant
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StoreProductVariant'
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
 *         $ref: '#/components/responses/NotFound'
 *       422:
 *         description: Invalid item_state_id or non-sellable item state
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrors'
 *             example:
 *               errors:
 *                 item_state_id: Invalid item state
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 *       503:
 *         description: No active default transaction currency
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorMessage'
 */
router.get("/", ...readAccess(), createListHandler());

module.exports = router;
module.exports.createListHandler = createListHandler;
module.exports.listCatalog = listCatalog;
