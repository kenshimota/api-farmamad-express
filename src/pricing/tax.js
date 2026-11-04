const Product = require("../models/product");
const Tax = require("../models/tax");
const { readField } = require("../shared/serializer");
const { toTaxSnapshot } = require("../shared/tax");

const TAX_ATTRIBUTES = Object.freeze(["id", "code", "name", "rate"]);

/**
 * Loads the current tax of a product and returns the snapshot stored in an
 * order or invoice line. A product without tax yields a zero-rate snapshot.
 * @param {number} productId - Product id.
 * @param {object} [options] - Injectable models.
 * @param {object} [options.productModel] - Product model.
 * @param {object} [options.taxModel] - Tax model.
 * @returns {Promise<{ tax_id: number|null, tax_code: string|null,
 *   tax_name: string|null, tax_rate: number }>} The tax snapshot.
 */
async function resolveProductTax(
  productId,
  { productModel = Product, taxModel = Tax } = {},
) {
  const product = await productModel.findByPk(productId, {
    include: [
      {
        model: taxModel,
        as: "tax",
        attributes: [...TAX_ATTRIBUTES],
        required: false,
      },
    ],
  });
  const tax = product ? readField(product, "tax") : null;

  return toTaxSnapshot(tax);
}

module.exports = { TAX_ATTRIBUTES, resolveProductTax };
