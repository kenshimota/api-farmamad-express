const { toPublicImage } = require("../images/serializer");
const { readField, toDecimalNumber } = require("../shared/serializer");
const { calculateTaxAmount } = require("../shared/tax");
const { round2 } = require("../purchases/money");

/**
 * Builds the compact item state exposed by the store catalog.
 * @param {object} itemState - Item state instance or plain object.
 * @returns {{ id: number, name: string, label: string }} Public item state.
 */
function toStoreItemState(itemState) {
  return {
    id: readField(itemState, "id"),
    name: readField(itemState, "name"),
    label: readField(itemState, "label"),
  };
}

/**
 * Builds the compact tax exposed by the store catalog.
 * @param {object|null} tax - Tax instance or plain object.
 * @returns {{ id: number, code: string, name: string, rate: number }|null}
 *   Public tax or null.
 */
function toStoreTax(tax) {
  if (!tax) {
    return null;
  }

  return {
    id: readField(tax, "id"),
    code: readField(tax, "code"),
    name: readField(tax, "name"),
    rate: toDecimalNumber(readField(tax, "rate"), 2),
  };
}

/**
 * Builds the compact currency exposed by the store catalog.
 * @param {object} currency - Currency instance or plain object.
 * @returns {{ id: number, code: string, name: string, symbol: string }}
 *   Public currency.
 */
function toStoreCurrency(currency) {
  return {
    id: readField(currency, "id"),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
  };
}

/**
 * Builds the compact category exposed by the store catalog.
 * @param {object|null} category - Category instance or plain object.
 * @returns {{ id: number, name: string }|null} Public category.
 */
function toStoreCategory(category) {
  if (!category) {
    return null;
  }

  return {
    id: readField(category, "id"),
    name: readField(category, "name"),
  };
}

/**
 * Builds the public product fields shared by the listing and the detail.
 * @param {object} product - Product instance or plain object.
 * @returns {object} Public product fields.
 */
function toStoreProduct(product) {
  const image = readField(product, "image");

  return {
    id: readField(product, "id"),
    name: readField(product, "name"),
    description: readField(product, "description"),
    reference: readField(product, "reference"),
    category_id: readField(product, "category_id"),
    image_id: readField(product, "image_id"),
    category: toStoreCategory(readField(product, "category")),
    image: image ? toPublicImage(image) : null,
  };
}

/**
 * Builds one listing entry for a product and item state variant.
 * @param {object} params - Variant data.
 * @param {object} params.product - Product instance or plain object.
 * @param {object} params.itemState - Item state instance or plain object.
 * @param {number} params.price - Resolved pre-tax price.
 * @param {object|null} params.tax - Product tax.
 * @param {object} params.currency - Transaction currency.
 * @param {boolean} params.available - Availability flag.
 * @returns {object} Public listing entry.
 */
function toStoreListVariant({
  product,
  itemState,
  price,
  tax,
  currency,
  available,
}) {
  const fields = toStoreProduct(product);
  const publicTax = toStoreTax(tax);
  const taxAmount = publicTax
    ? calculateTaxAmount(price, publicTax.rate)
    : 0;

  return {
    id: fields.id,
    name: fields.name,
    description: fields.description,
    reference: fields.reference,
    category_id: fields.category_id,
    image_id: fields.image_id,
    item_state: toStoreItemState(itemState),
    price: toDecimalNumber(price, 2),
    tax: publicTax,
    tax_amount: round2(taxAmount),
    total: round2(Number(price) + taxAmount),
    currency_id: readField(currency, "id"),
    currency: toStoreCurrency(currency),
    available: Boolean(available),
    category: fields.category,
    image: fields.image,
  };
}

/**
 * Builds one variant of the product detail.
 * @param {object} params - Variant data.
 * @param {object} params.itemState - Item state instance or plain object.
 * @param {number} params.price - Resolved pre-tax price.
 * @param {object|null} params.tax - Product tax.
 * @param {object} params.currency - Transaction currency.
 * @param {boolean} params.available - Availability flag.
 * @returns {object} Public detail variant.
 */
function toStoreDetailVariant({
  itemState,
  price,
  tax,
  currency,
  available,
}) {
  const publicTax = toStoreTax(tax);
  const taxAmount = publicTax
    ? calculateTaxAmount(price, publicTax.rate)
    : 0;

  return {
    item_state: toStoreItemState(itemState),
    price: toDecimalNumber(price, 2),
    tax: publicTax,
    tax_amount: round2(taxAmount),
    total: round2(Number(price) + taxAmount),
    currency_id: readField(currency, "id"),
    currency: toStoreCurrency(currency),
    available: Boolean(available),
  };
}

/**
 * Builds the product detail with its priced variants.
 * @param {object} product - Product instance or plain object.
 * @param {object[]} variants - Serialized detail variants.
 * @returns {object} Public product detail.
 */
function toStoreProductDetail(product, variants) {
  return {
    ...toStoreProduct(product),
    variants,
  };
}

module.exports = {
  toStoreCategory,
  toStoreCurrency,
  toStoreDetailVariant,
  toStoreItemState,
  toStoreListVariant,
  toStoreProduct,
  toStoreProductDetail,
  toStoreTax,
};
