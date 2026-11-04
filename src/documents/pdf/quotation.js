const {
  formatDate,
  formatDateTime,
  formatMoney,
  formatRate,
  truncateNotes,
} = require("../formatters");
const {
  companyHeader,
  createDocument,
  ensureSpace,
  finalize,
  keyValue,
  sectionTitle,
  table,
  toBuffer,
} = require("./layout");

const SOURCE_COLUMNS = Object.freeze([
  { label: "Producto", width: 150 },
  { label: "Referencia", width: 65 },
  { label: "Estado", width: 85 },
  { label: "Cant.", width: 35, align: "right" },
  { label: "Precio unit.", width: 88, align: "right" },
  { label: "Subtotal", width: 89, align: "right" },
]);
const TARGET_COLUMNS = SOURCE_COLUMNS;

/**
 * Builds a table row for the source or target currency.
 * @param {object} item - Quotation line.
 * @param {"source"|"target"} side - Amounts to use.
 * @returns {unknown[]} The row cells.
 */
function lineRow(item, side) {
  return [
    item.product_name,
    item.product_reference,
    item.item_state_name,
    item.quantity,
    formatMoney(
      side === "source" ? item.unit_price_source : item.unit_price_target,
      null,
    ),
    formatMoney(
      side === "source" ? item.subtotal_source : item.subtotal_target,
      null,
    ),
  ];
}

/**
 * Draws one amounts table.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} data - Quotation data.
 * @param {"source"|"target"} side - Amounts to render.
 * @param {string} title - Table title.
 * @returns {void}
 */
function amountsTable(doc, data, side, title) {
  sectionTitle(doc, title);
  table(
    doc,
    side === "source" ? SOURCE_COLUMNS : TARGET_COLUMNS,
    data.items.map((item) => lineRow(item, side)),
  );
}

/**
 * Draws the totals, conversion block and legal notes.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} data - Quotation data.
 * @returns {void}
 */
function totalsAndNotes(doc, data) {
  sectionTitle(doc, "Totales");
  keyValue(
    doc,
    `Subtotal (${data.source_currency.code})`,
    formatMoney(data.subtotal_source, data.source_currency),
  );
  keyValue(
    doc,
    `Total (${data.source_currency.code})`,
    formatMoney(data.total_source, data.source_currency),
  );

  if (data.is_conversion) {
    keyValue(
      doc,
      `Subtotal (${data.target_currency.code})`,
      formatMoney(data.subtotal_target, data.target_currency),
    );
    keyValue(
      doc,
      `Total (${data.target_currency.code})`,
      formatMoney(data.total_target, data.target_currency),
    );

    if (data.rounding_adjustment !== 0) {
      keyValue(
        doc,
        "Ajuste por redondeo",
        formatMoney(data.rounding_adjustment, data.target_currency),
      );
    }

    sectionTitle(doc, "Conversión");
    keyValue(doc, "Moneda origen", data.source_currency.code);
    keyValue(doc, "Moneda destino", data.target_currency.code);
    keyValue(doc, "Tasa aplicada", formatRate(data.exchange_rate));
    keyValue(
      doc,
      `Último cambio de tasa ${data.source_currency.code}`,
      formatDate(data.source_rate_changed_at) || "Sin historial",
    );
    keyValue(
      doc,
      `Último cambio de tasa ${data.target_currency.code}`,
      formatDate(data.target_rate_changed_at) || "Sin historial",
    );
  }

  ensureSpace(doc, 60);
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#333")
    .text(
      "Cotización informativa. Los precios en otra moneda se recalculan con la tasa vigente y pueden variar.",
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      },
    );
  doc
    .font("Helvetica-Bold")
    .fillColor("#a00")
    .text("Documento no fiscal.", {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });
}

/**
 * Renders the quotation PDF.
 * @param {object} data - Quotation document data.
 * @param {object} company - Emitter profile.
 * @returns {Promise<Buffer>} The PDF bytes.
 */
function renderQuotationPdf(data, company) {
  const doc = createDocument({
    Title: `Cotización pedido ${data.order.number}`,
    Author: company.name,
  });
  const pending = toBuffer(doc);
  const paymentTerm = data.payment_term
    ? `${data.payment_term.name} (${data.payment_term.days} días)`
    : "Por definir";

  companyHeader(doc, company);
  doc.font("Helvetica-Bold").fontSize(18).text("COTIZACIÓN");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333")
    .text(`Pedido N° ${data.order.number}`);
  doc.text(`Fecha de emisión: ${formatDateTime(data.issued_at)}`);
  doc.text(`Estado del pedido: ${data.order.status}`);
  doc.moveDown(0.6);

  sectionTitle(doc, "Cliente");
  keyValue(doc, "Nombre", data.customer?.fullName);
  keyValue(doc, "Correo", data.customer?.email);
  keyValue(doc, "Dirección", data.customer?.direction);

  if (data.delivery_address) {
    keyValue(doc, "Dirección de entrega", data.delivery_address);
  }

  if (data.notes) {
    keyValue(doc, "Notas", truncateNotes(data.notes));
  }

  keyValue(doc, "Término de pago", paymentTerm);

  if (data.is_conversion) {
    amountsTable(
      doc,
      data,
      "source",
      `Importes en ${data.source_currency.code} (moneda del pedido)`,
    );
    amountsTable(
      doc,
      data,
      "target",
      `Importes en ${data.target_currency.code} (moneda de la cotización)`,
    );
  } else {
    amountsTable(
      doc,
      data,
      "target",
      `Importes en ${data.target_currency.code}`,
    );
  }

  totalsAndNotes(doc, data);
  const footer = `Generado por ${company.name} ERP el ${formatDateTime(data.issued_at)}.`;
  finalize(doc, footer);

  return pending;
}

module.exports = { renderQuotationPdf };
