const { Op } = require("sequelize");
const OrderItem = require("../models/order-item");
const OrderItemLotAllocation = require("../models/order-item-lot-allocation");
const Lot = require("../models/lot");
const Product = require("../models/product");
const ItemState = require("../models/item-state");
const Warehouse = require("../models/warehouse");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const Customer = require("../models/customer");

const ORDER_ATTRIBUTES = Object.freeze([
  "id",
  "number",
  "status",
  "customer_id",
  "delivery_address",
  "notes",
  "createdAt",
]);
const CUSTOMER_INCLUDE = Object.freeze({
  model: Customer,
  as: "customer",
  attributes: ["id", "fullName", "email", "direction"],
});
const PRODUCT_INCLUDE = Object.freeze({
  model: Product,
  as: "product",
  attributes: ["id", "name", "reference", "image_id"],
});
const ITEM_STATE_INCLUDE = Object.freeze({
  model: ItemState,
  as: "item_state",
  attributes: ["id", "name", "label"],
});
const LOT_INCLUDE = Object.freeze({
  model: Lot,
  as: "lot",
  attributes: [
    "id",
    "number",
    "expiration_date",
    "location_status",
    "stock",
    "reserved",
  ],
  include: [
    {
      model: Warehouse,
      as: "warehouse",
      attributes: ["id", "name"],
    },
    {
      model: Shelf,
      as: "shelf",
      attributes: ["id", "code", "name"],
    },
    {
      model: ShelfSection,
      as: "section",
      attributes: ["id", "code", "name"],
    },
  ],
});

/**
 * Builds the include of the allocations filtered by status. `required: false`
 * keeps the order lines that have no matching allocation.
 * @param {string[]} statuses - Statuses to include.
 * @returns {object} The Sequelize include.
 */
function buildAllocationInclude(statuses) {
  return {
    model: OrderItemLotAllocation,
    as: "allocations",
    required: false,
    where: { status: { [Op.in]: statuses } },
    include: [{ ...LOT_INCLUDE }],
  };
}

/**
 * Builds the include of the order lines with their product, item state and
 * allocations. A single nested include tree loads the whole picking view.
 * @param {string[]} statuses - Allocation statuses to include.
 * @returns {object} The Sequelize include.
 */
function buildItemsInclude(statuses) {
  return {
    model: OrderItem,
    as: "items",
    attributes: ["id", "product_id", "item_state_id", "quantity"],
    include: [
      { ...PRODUCT_INCLUDE },
      { ...ITEM_STATE_INCLUDE },
      buildAllocationInclude(statuses),
    ],
  };
}

/**
 * Builder that assembles the whole eager-loaded query of the picking view. The
 * order and every relation are loaded in one query, so no query is issued per
 * line or per allocation.
 * @param {string[]} statuses - Allocation statuses to include.
 * @returns {{ attributes: string[], include: object[] }} The findByPk options.
 */
function buildPickingQuery(statuses) {
  return {
    attributes: [...ORDER_ATTRIBUTES],
    include: [{ ...CUSTOMER_INCLUDE }, buildItemsInclude(statuses)],
  };
}

module.exports = {
  ORDER_ATTRIBUTES,
  buildAllocationInclude,
  buildItemsInclude,
  buildPickingQuery,
};
