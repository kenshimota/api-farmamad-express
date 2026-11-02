const CustomerWallet = require("../../src/models/customer-wallet");
const CustomerSeller = require("../../src/models/customer-seller");
const { ensureStandardPaymentTerms } = require("./payment-terms");
const { createLot, createSaleFixture, createStock } = require("./orders");

/**
 * Builds a sale fixture with an active payment term, one lot and its stock row.
 * @param {object} [options] - Fixture options.
 * @param {number} [options.stock] - Physical units in the lot.
 * @param {number} [options.reserved] - Already reserved units.
 * @param {string} [options.term] - Standard payment term code.
 * @param {string} [options.cost] - Unit cost.
 * @param {string} [options.percentage] - Price list margin.
 * @param {object} [options.session] - Session overrides.
 * @returns {Promise<object>} Fixture with customer, token, lot, stock and term.
 */
async function createOrderFixture({
  stock = 10,
  reserved = 0,
  term = "credit_10",
  cost = "10.00",
  percentage = "30.00",
  session = {},
} = {}) {
  const fixture = await createSaleFixture({
    cost,
    session: { percentage, ...session },
  });
  const terms = await ensureStandardPaymentTerms();
  const paymentTerm = terms[term];

  await fixture.customer.update({ payment_term_id: paymentTerm.id });

  const lot = await createLot(
    fixture.product,
    fixture.itemState,
    fixture.location,
    { stock, reserved },
  );
  const stockRow = await createStock(fixture.product, fixture.itemState, stock);

  return { ...fixture, lot, stockRow, paymentTerm };
}

/**
 * Adds balance to the customer wallet in one currency.
 * @param {object} customer - Customer instance.
 * @param {object} currency - Currency instance.
 * @param {number|string} balance - Wallet balance.
 * @returns {Promise<object>} The wallet.
 */
async function setWalletBalance(customer, currency, balance) {
  const [wallet] = await CustomerWallet.findOrCreate({
    where: { customer_id: customer.id, currency_id: currency.id },
    defaults: { balance },
  });

  return wallet.update({ balance });
}

/**
 * Assigns a customer to a seller.
 * @param {object} customer - Customer instance.
 * @param {object} seller - Seller user instance.
 * @returns {Promise<object>} The assignment.
 */
function assignSeller(customer, seller) {
  return CustomerSeller.create({
    customer_id: customer.id,
    seller_id: seller.id,
  });
}

module.exports = {
  assignSeller,
  createOrderFixture,
  setWalletBalance,
};
