/**
 * Converts a money value into integer cents to compare without float noise.
 * @param {unknown} value - Raw decimal value.
 * @returns {number} The amount in cents.
 */
function toCents(value) {
  return Math.round(Number(value) * 100);
}

/**
 * Rounds a money value to two decimals.
 * @param {unknown} value - Raw decimal value.
 * @returns {number} The rounded amount.
 */
function round2(value) {
  return Number(Number(value).toFixed(2));
}

/**
 * Calculates the rate between the payment and invoice currencies with six
 * decimals, matching `exchange_rate DECIMAL(18,6)`.
 * @param {unknown} paymentRate - Payment currency rate in VES.
 * @param {unknown} invoiceRate - Invoice currency rate in VES.
 * @returns {number} The exchange rate.
 */
function calculateExchangeRate(paymentRate, invoiceRate) {
  const rate = Number(paymentRate) / Number(invoiceRate);

  return Number.isFinite(rate) && rate > 0 ? Number(rate.toFixed(6)) : 0;
}

/**
 * Calculates the amount credited to the invoice and rounds it to two decimals.
 * @param {unknown} amount - Amount debited from the wallet.
 * @param {unknown} exchangeRate - Exchange rate used at allocation time.
 * @returns {number} The applied amount.
 */
function calculateAppliedAmount(amount, exchangeRate) {
  return round2(Number(amount) * Number(exchangeRate));
}

/**
 * Maps the accumulated paid amount to the invoice payment status.
 * @param {unknown} paidAmount - Accumulated paid amount.
 * @param {unknown} total - Invoice total.
 * @returns {"pending"|"partial"|"paid"} The payment status.
 */
function calculatePaymentStatus(paidAmount, total) {
  const paid = toCents(paidAmount);
  const totalCents = toCents(total);

  if (paid <= 0) {
    return "pending";
  }

  if (paid >= totalCents) {
    return "paid";
  }

  return "partial";
}

module.exports = {
  calculateAppliedAmount,
  calculateExchangeRate,
  calculatePaymentStatus,
  round2,
  toCents,
};
