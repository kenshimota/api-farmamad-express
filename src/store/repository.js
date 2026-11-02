const { Op, col, fn } = require("sequelize");
const Category = require("../models/category");
const Cost = require("../models/cost");
const Currency = require("../models/currency");
const Customer = require("../models/customer");
const CustomerSeller = require("../models/customer-seller");
const Image = require("../models/image");
const ItemState = require("../models/item-state");
const Lot = require("../models/lot");
const PriceList = require("../models/price-list");
const Product = require("../models/product");
const Stock = require("../models/stock");
const { CURRENCY_SUMMARY_ATTRIBUTES } = require("../currencies/attributes");
const { resolveDefaultTransactionCurrency } = require("../currencies/default");
const {
  CATEGORY_ATTRIBUTES,
  COST_ATTRIBUTES,
  CUSTOMER_ATTRIBUTES,
  IMAGE_ATTRIBUTES,
  ITEM_STATE_ATTRIBUTES,
  ORDER,
  PRODUCT_ATTRIBUTES,
  buildOrder,
  variantKey,
} = require("./attributes");

/**
 * Creates the repository that encapsulates every store read query. Models and
 * the currency resolver are injectable so the abstraction stays testable.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.costModel] - Cost model.
 * @param {object} [dependencies.currencyModel] - Currency model.
 * @param {object} [dependencies.customerModel] - Customer model.
 * @param {object} [dependencies.customerSellerModel] - Assignment model.
 * @param {object} [dependencies.itemStateModel] - Item state model.
 * @param {object} [dependencies.lotModel] - Lot model.
 * @param {object} [dependencies.priceListModel] - Price list model.
 * @param {object} [dependencies.productModel] - Product model.
 * @param {object} [dependencies.categoryModel] - Category model.
 * @param {object} [dependencies.imageModel] - Image model.
 * @param {object} [dependencies.stockModel] - Stock model.
 * @param {Function} [dependencies.resolveTransactionCurrency] - Default
 *   transaction currency resolver.
 * @returns {object} Store repository.
 */
function createStoreRepository({
  costModel = Cost,
  currencyModel = Currency,
  customerModel = Customer,
  customerSellerModel = CustomerSeller,
  itemStateModel = ItemState,
  lotModel = Lot,
  priceListModel = PriceList,
  productModel = Product,
  categoryModel = Category,
  imageModel = Image,
  stockModel = Stock,
  resolveTransactionCurrency = resolveDefaultTransactionCurrency,
} = {}) {
  const productInclude = {
    model: productModel,
    as: "product",
    required: true,
    attributes: [...PRODUCT_ATTRIBUTES],
    include: [
      {
        model: categoryModel,
        as: "category",
        attributes: [...CATEGORY_ATTRIBUTES],
      },
      {
        model: imageModel,
        as: "image",
        attributes: [...IMAGE_ATTRIBUTES],
      },
    ],
  };

  return {
    /**
     * Loads the customer and its assigned price list in one query.
     * @param {number} customerId - Customer id.
     * @returns {Promise<object|null>} The customer or null.
     */
    findCustomer(customerId) {
      return customerModel.findByPk(customerId, {
        attributes: [...CUSTOMER_ATTRIBUTES],
        include: [
          {
            model: priceListModel,
            as: "price_list",
            attributes: ["id", "percentage"],
            required: false,
          },
        ],
      });
    },

    /**
     * Tells whether a seller is assigned to a customer.
     * @param {number} customerId - Customer id.
     * @param {number} sellerId - Seller user id.
     * @returns {Promise<boolean>} True when the assignment exists.
     */
    async isCustomerAssigned(customerId, sellerId) {
      const count = await customerSellerModel.count({
        where: { customer_id: customerId, seller_id: sellerId },
      });

      return count > 0;
    },

    /**
     * Loads one item state to validate the optional filter.
     * @param {number} itemStateId - Item state id.
     * @returns {Promise<object|null>} The item state or null.
     */
    findItemState(itemStateId) {
      return itemStateModel.findByPk(itemStateId, {
        attributes: [...ITEM_STATE_ATTRIBUTES],
      });
    },

    /**
     * Resolves the active default transaction currency.
     * @returns {Promise<object>} The default currency.
     */
    findDefaultCurrency() {
      return resolveTransactionCurrency({ model: currencyModel });
    },

    /**
     * Lists the costs that can produce a sellable variant, eagerly loading the
     * product, category, image, item state and cost currency. The item state
     * must be sellable and the cost currency active, so no variant is resolved
     * with an unusable currency.
     * @param {object} [filters] - Query filters.
     * @param {number} [filters.productId] - Exact product id.
     * @param {number} [filters.itemStateId] - Exact item state id.
     * @returns {Promise<object[]>} The cost rows ordered by product name, id
     *   and item state id.
     */
    findCosts({ productId, itemStateId } = {}) {
      const where = {};

      if (productId !== undefined) {
        where.product_id = productId;
      }

      if (itemStateId !== undefined) {
        where.item_state_id = itemStateId;
      }

      return costModel.findAll({
        where,
        attributes: [...COST_ATTRIBUTES],
        include: [
          productInclude,
          {
            model: itemStateModel,
            as: "item_state",
            required: true,
            attributes: [...ITEM_STATE_ATTRIBUTES],
            where: { is_sellable: true },
          },
          {
            model: currencyModel,
            as: "currency",
            required: true,
            attributes: [...CURRENCY_SUMMARY_ATTRIBUTES, "rate", "is_active"],
            where: { is_active: true },
          },
        ],
        order: buildOrder(productModel, itemStateModel),
      });
    },

    /**
     * Aggregates the lots of every requested product + item state pair in one
     * query. `stock - reserved` is the real availability and `stock` is used to
     * validate the stock control row.
     * @param {object} keys - Requested keys.
     * @param {number[]} keys.productIds - Product ids.
     * @param {number[]} keys.itemStateIds - Item state ids.
     * @returns {Promise<object>} Map keyed by `variantKey` with `stock`,
     *   `reserved` and `available`.
     */
    async findAvailability({ productIds, itemStateIds }) {
      if (productIds.length === 0 || itemStateIds.length === 0) {
        return {};
      }

      const rows = await lotModel.findAll({
        attributes: [
          "product_id",
          "item_state_id",
          [fn("SUM", col("stock")), "stock_total"],
          [fn("SUM", col("reserved")), "reserved_total"],
        ],
        where: {
          product_id: { [Op.in]: productIds },
          item_state_id: { [Op.in]: itemStateIds },
        },
        group: ["product_id", "item_state_id"],
        raw: true,
      });

      return rows.reduce((availability, row) => {
        const stock = Number(row.stock_total);
        const reserved = Number(row.reserved_total);
        const key = variantKey(row.product_id, row.item_state_id);

        availability[key] = {
          stock,
          reserved,
          available: stock - reserved > 0,
        };

        return availability;
      }, {});
    },

    /**
     * Loads the stock control quantities of every requested product + item
     * state pair in one query.
     * @param {object} keys - Requested keys.
     * @param {number[]} keys.productIds - Product ids.
     * @param {number[]} keys.itemStateIds - Item state ids.
     * @returns {Promise<object>} Map keyed by `variantKey` with the stored
     *   quantity.
     */
    async findStockQuantities({ productIds, itemStateIds }) {
      if (productIds.length === 0 || itemStateIds.length === 0) {
        return {};
      }

      const rows = await stockModel.findAll({
        attributes: ["product_id", "item_state_id", "quantity"],
        where: {
          product_id: { [Op.in]: productIds },
          item_state_id: { [Op.in]: itemStateIds },
        },
        raw: true,
      });

      return rows.reduce((quantities, row) => {
        quantities[variantKey(row.product_id, row.item_state_id)] = Number(
          row.quantity,
        );
        return quantities;
      }, {});
    },
  };
}

const storeRepository = createStoreRepository();

module.exports = {
  CATEGORY_ATTRIBUTES,
  COST_ATTRIBUTES,
  IMAGE_ATTRIBUTES,
  ITEM_STATE_ATTRIBUTES,
  ORDER,
  PRODUCT_ATTRIBUTES,
  createStoreRepository,
  storeRepository,
  variantKey,
};
