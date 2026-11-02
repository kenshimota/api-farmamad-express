const { Op } = require("sequelize");
const Product = require("../../src/models/product");
const Image = require("../../src/models/image");
const Category = require("../../src/models/category");
const Supplier = require("../../src/models/supplier");
const Warehouse = require("../../src/models/warehouse");
const Shelf = require("../../src/models/shelf");
const ShelfSection = require("../../src/models/shelf-section");
const Cost = require("../../src/models/cost");
const Lot = require("../../src/models/lot");
const Stock = require("../../src/models/stock");

const DEMO_REFERENCE = { [Op.like]: "FARMATODO-%" };
const DEMO_IMAGE = { [Op.like]: "demo-farmatodo-%" };

/**
 * Counts every table touched by the demo seed, so the idempotency test can
 * compare two executions exactly.
 * @returns {Promise<object>} Row counts.
 */
async function countDemoRows() {
  return {
    categories: await Category.count(),
    images: await Image.count({ where: { reference: DEMO_IMAGE } }),
    products: await Product.count({ where: { reference: DEMO_REFERENCE } }),
    suppliers: await Supplier.count(),
    warehouses: await Warehouse.count(),
    shelves: await Shelf.count(),
    sections: await ShelfSection.count(),
    costs: await Cost.count(),
    lots: await Lot.count(),
    stocks: await Stock.count(),
  };
}

module.exports = { DEMO_IMAGE, DEMO_REFERENCE, countDemoRows };
