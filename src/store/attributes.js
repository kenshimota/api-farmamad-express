const ItemState = require("../models/item-state");
const Product = require("../models/product");

const CATEGORY_ATTRIBUTES = Object.freeze(["id", "name"]);
const PRODUCT_ATTRIBUTES = Object.freeze([
  "id",
  "name",
  "description",
  "reference",
  "category_id",
  "image_id",
]);
const IMAGE_ATTRIBUTES = Object.freeze([
  "id",
  "url",
  "pathname",
  "reference",
  "thumbnail",
]);
const ITEM_STATE_ATTRIBUTES = Object.freeze([
  "id",
  "name",
  "label",
  "is_sellable",
]);
const COST_ATTRIBUTES = Object.freeze([
  "product_id",
  "item_state_id",
  "cost",
  "currency_id",
]);
const CUSTOMER_ATTRIBUTES = Object.freeze(["id", "price_list_id"]);

/**
 * Builds the listing order with the models used by the current repository, so
 * injected models and the application models produce the same query.
 * @param {object} productModel - Product model.
 * @param {object} itemStateModel - Item state model.
 * @returns {Array} Sequelize order clauses.
 */
function buildOrder(productModel, itemStateModel) {
  return [
    [{ model: productModel, as: "product" }, "name", "ASC"],
    [{ model: productModel, as: "product" }, "id", "ASC"],
    [{ model: itemStateModel, as: "item_state" }, "id", "ASC"],
  ];
}

const ORDER = buildOrder(Product, ItemState);

/**
 * Builds the stable key used to join availability and stock rows with a
 * product + item state variant.
 * @param {number} productId - Product id.
 * @param {number} itemStateId - Item state id.
 * @returns {string} The map key.
 */
function variantKey(productId, itemStateId) {
  return `${productId}:${itemStateId}`;
}

module.exports = {
  CATEGORY_ATTRIBUTES,
  COST_ATTRIBUTES,
  CUSTOMER_ATTRIBUTES,
  IMAGE_ATTRIBUTES,
  ITEM_STATE_ATTRIBUTES,
  ORDER,
  PRODUCT_ATTRIBUTES,
  buildOrder,
  variantKey,
};
