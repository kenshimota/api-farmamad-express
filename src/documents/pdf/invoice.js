const {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPaymentStatus,
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

const ITEM_COLUMNS = Object.freeze([
  { label: "Producto", width: 160 },
  { label: "Referencia", width: 70 },
  { label: "Estado", width: 85 },
  { label: "Cant.", width: 35, align: "right" },
  { label: "Precio unit.", width: 81, align: "right" },
  { label: "Subtotal", width: 81, align: "right" },
]);
const PAYMENT_COLUMNS = Object.freeze([
  { label: "Fecha", width: 110 },
  { label: "Monto", width: 110, align: "right" },
  { label: "Moneda", width: 90 },
  { label: "Aplicado", width: 100, align: "right" },
  { label: "Método", width: 102 },
]);

/**
 * Draws the invoice line table.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} data - Invoice document data.
 * @returns {void}
 */
function itemTable(doc, data) {
  sectionTitle(doc, `Importes en ${data.currency?.code ?? ""}`);
  table(
    doc,
    ITEM_COLUMNS,
    data.items.map((item) => [
      item.product_name,
      item.product_reference,
      item.item_state_name,
      item.quantity,
      formatMoney(item.unit_price, null),
      formatMoney(item.subtotal, null),
    ]),
  );
}

/**
 * Draws the invoice totals.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} data - Invoice document data.
 * @returns {void}
 */
function totals(doc, data) {
  const { invoice, currency } = data;

  sectionTitle(doc, "Totales");
  keyValue(doc, "Subtotal", formatMoney(invoice.subtotal, currency));
  keyValue(doc, "Impuesto", formatMoney(invoice.tax_amount, currency));
  keyValue(doc, "Total", formatMoney(invoice.total, currency));
  keyValue(doc, "Pagado", formatMoney(invoice.paid_amount, currency));
  keyValue(doc, "Saldo pendiente", formatMoney(invoice.balance_due, currency));
  keyValue(doc, "Estado de pago", formatPaymentStatus(invoice.payment_status));
}

/**
 * Draws the summarized payment history.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} data - Invoice document data.
 * @returns {void}
 */
function paymentHistory(doc, data) {
  if (data.payments.length === 0) {
    return;
  }

  sectionTitle(doc, "Pagos aplicados");
  table(
    doc,
    PAYMENT_COLUMNS,
    data.payments.map((payment) => [
      formatDate(payment.allocated_at),
      formatMoney(payment.amount, payment.currency),
      payment.currency?.code ?? "",
      formatMoney(payment.applied_amount, data.currency),
      payment.method ?? "-",
    ]),
  );
}

/**
 * Renders the invoice PDF.
 * @param {object} data - Invoice document data.
 * @param {object} company - Emitter profile.
 * @returns {Promise<Buffer>} The PDF bytes.
 */
function renderInvoicePdf(data, company) {
  const doc = createDocument({
    Title: `Factura ${data.invoice.number}`,
    Author: company.name,
  });
  const pending = toBuffer(doc);
  const { invoice } = data;

  companyHeader(doc, company);
  doc.font("Helvetica-Bold").fontSize(18).text("FACTURA");
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#333")
    .text(`Factura N° ${invoice.number}`);

  if (data.order_number !== null && data.order_number !== undefined) {
    doc.text(`Pedido N° ${data.order_number}`);
  }

  doc.text(`Fecha de emisión: ${formatDateTime(invoice.issued_at)}`);
  doc.text(`Fecha de vencimiento: ${formatDate(invoice.due_date)}`);
  doc.moveDown(0.6);

  sectionTitle(doc, "Cliente");
  keyValue(doc, "Nombre", data.customer?.fullName);
  keyValue(doc, "Correo", data.customer?.email);
  keyValue(doc, "Dirección", data.customer?.direction);
  keyValue(
    doc,
    "Término de pago",
    data.payment_term
      ? `${data.payment_term.name} (${data.payment_term.days} días)`
      : "Por definir",
  );

  itemTable(doc, data);
  totals(doc, data);
  paymentHistory(doc, data);

  if (invoice.notes) {
    ensureSpace(doc, 40);
    sectionTitle(doc, "Notas");
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor("#333")
      .text(truncateNotes(invoice.notes), {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      });
  }

  ensureSpace(doc, 30);
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(8)
    .fillColor("#a00")
    .text("Documento no fiscal.", {
      width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
    });

  const footer = `Generado por ${company.name} ERP el ${formatDateTime(data.generated_at)}.`;
  finalize(doc, footer);

  return pending;
}

module.exports = { renderInvoicePdf };
