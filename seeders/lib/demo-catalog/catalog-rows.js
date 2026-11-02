const { Op } = require("sequelize");
const Category = require("../../../src/models/category");
const Cost = require("../../../src/models/cost");
const Image = require("../../../src/models/image");
const Lot = require("../../../src/models/lot");
const Product = require("../../../src/models/product");
const Stock = require("../../../src/models/stock");
const { getPublicBaseUrl } = require("../../../src/products/image-config");
const { findOrCreate, options, upsert } = require("./helpers");

const LOT_STOCK = 100;

/**
 * Creates or updates the demo category.
 * @param {string} name - Category name.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Category instance.
 */
function ensureCategory(name, transaction) {
  return findOrCreate(Category, { name }, { name }, transaction);
}

/**
 * Creates or updates the demo image of a product using PUBLIC_BASE_URL.
 * @param {object} product - Fixture product.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Image instance.
 */
async function ensureImage(product, transaction) {
  const baseUrl = getPublicBaseUrl();
  const pathname = `/uploads/products/demo/${product.image.original}`;
  const values = {
    url: `${baseUrl}${pathname}`,
    pathname,
    reference: product.image.reference,
    thumbnail: `${baseUrl}/uploads/products/demo/${product.image.thumbnail}`,
  };

  return upsert(
    Image,
    { reference: product.image.reference },
    values,
    transaction,
  );
}

/**
 * Creates or updates a demo product using the keys of HU-44.
 * @param {object} product - Fixture product.
 * @param {{ categoryId: number, imageId: number, taxId: number }} keys - FKs.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Product instance.
 */
async function ensureProduct(product, keys, transaction) {
  const values = {
    name: product.name,
    description: product.description,
    reference: product.reference,
    category_id: keys.categoryId,
    image_id: keys.imageId,
    tax_id: keys.taxId,
  };

  return upsert(Product, { reference: product.reference }, values, transaction);
}

/**
 * Creates or updates the current cost of a demo product.
 * @param {object} product - Fixture product.
 * @param {object} keys - Product, item state and currency ids.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Cost instance.
 */
async function ensureCost(product, keys, transaction) {
  const where = {
    product_id: keys.productId,
    item_state_id: keys.itemStateId,
  };
  const values = { cost: product.cost, currency_id: keys.currencyId };

  return upsert(Cost, where, values, transaction);
}

/**
 * Creates or updates a located demo lot through the Lot model, so HU-46 hooks
 * run when those columns arrive.
 * @param {object} product - Fixture product.
 * @param {object} keys - Product, item state and location ids.
 * @param {Date} seededAt - Seed timestamp.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Lot instance.
 */
async function ensureLot(product, keys, seededAt, transaction) {
  const number = `LOTE-DEMO-${product.external_id}`;
  const expiration = new Date(seededAt);
  expiration.setUTCFullYear(expiration.getUTCFullYear() + 1);
  const values = {
    number,
    product_id: keys.productId,
    expiration_date: expiration.toISOString().slice(0, 10),
    item_state_id: keys.itemStateId,
    stock: LOT_STOCK,
    reserved: 0,
    warehouse_id: keys.warehouseId,
    shelf_id: keys.shelfId,
    section_id: keys.sectionId,
  };
  return upsert(
    Lot,
    { product_id: keys.productId, number: { [Op.iLike]: number } },
    values,
    transaction,
  );
}

/**
 * Sets stock.quantity to the sum of the lots of the product and item state.
 * @param {object} keys - Product and item state ids.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<number>} The reconciled quantity.
 */
async function ensureStock(keys, transaction) {
  const quantity =
    (await Lot.sum("stock", {
      where: {
        product_id: keys.productId,
        item_state_id: keys.itemStateId,
      },
      ...options(transaction),
    })) || 0;
  const where = {
    product_id: keys.productId,
    item_state_id: keys.itemStateId,
  };
  const existing = await Stock.findOne({ where, ...options(transaction) });

  if (existing) {
    await existing.update({ quantity }, options(transaction));
  } else {
    await Stock.create({ ...where, quantity }, options(transaction));
  }

  return quantity;
}

/**
 * Re-reads the demo stocks and proves that quantity equals SUM(lots.stock).
 * @param {number[]} productIds - Demo product ids.
 * @param {number} itemStateId - Sellable item state id.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<void>}
 * @throws {Error} When any pair is inconsistent.
 */
async function verifyStocks(productIds, itemStateId, transaction) {
  const stocks = await Stock.findAll({
    where: { product_id: { [Op.in]: productIds }, item_state_id: itemStateId },
    ...options(transaction),
  });

  for (const stock of stocks) {
    const total =
      (await Lot.sum("stock", {
        where: {
          product_id: stock.product_id,
          item_state_id: itemStateId,
        },
        ...options(transaction),
      })) || 0;

    if (Number(stock.quantity) !== Number(total)) {
      throw new Error(
        `Stock inconsistency for product ${stock.product_id}: quantity ${stock.quantity} != lots ${total}.`,
      );
    }
  }
}

module.exports = {
  LOT_STOCK,
  ensureCategory,
  ensureCost,
  ensureImage,
  ensureLot,
  ensureProduct,
  ensureStock,
  verifyStocks,
};
