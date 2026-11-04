const { parseBooleanFlag } = require("../shared/parsers");

/**
 * Parses the optional `download` query flag. `undefined` means invalid.
 * @param {unknown} value - Raw query value.
 * @returns {boolean|undefined} The flag or undefined when invalid.
 */
function parseDownloadFlag(value) {
  if (value === undefined) {
    return false;
  }

  return parseBooleanFlag(value);
}

/**
 * Builds the quotation filename.
 * @param {object} data - Quotation data with order and target currency.
 * @returns {string} The filename.
 */
function quotationFilename(data) {
  return `cotizacion-pedido-${data.order.number}-${data.target_currency.code}.pdf`;
}

/**
 * Builds the invoice filename.
 * @param {object} data - Invoice document data.
 * @returns {string} The filename.
 */
function invoiceFilename(data) {
  return `factura-${data.invoice.number}.pdf`;
}

/**
 * Sends a PDF response with the download-safe headers.
 * @param {import("express").Response} res - Express response.
 * @param {Buffer} buffer - PDF bytes.
 * @param {object} options - Delivery options.
 * @param {string} options.filename - Suggested filename.
 * @param {boolean} options.download - Force attachment when true.
 * @returns {import("express").Response} The response.
 */
function sendPdf(res, buffer, { filename, download }) {
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });

  return res.send(buffer);
}

module.exports = {
  invoiceFilename,
  parseDownloadFlag,
  quotationFilename,
  sendPdf,
};
