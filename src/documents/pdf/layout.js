const PDFDocument = require("pdfkit");
const { sanitizeText } = require("../formatters");

const PAGE = Object.freeze({ size: "LETTER", margin: 50 });
const FOOTER_Y_OFFSET = 42;

/**
 * Creates a new buffered PDF document with the shared page settings.
 * @param {object} [info] - PDF metadata.
 * @returns {PDFKit.PDFDocument} The document.
 */
function createDocument(info = {}) {
  return new PDFDocument({
    size: PAGE.size,
    margin: PAGE.margin,
    bufferPages: true,
    info,
  });
}

/**
 * Returns the usable width of the current page.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @returns {number} The content width.
 */
function contentWidth(doc) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

/**
 * Adds a page when the requested height does not fit in the current one.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {number} height - Required height.
 * @returns {boolean} True when a new page was added.
 */
function ensureSpace(doc, height) {
  const bottom = doc.page.height - doc.page.margins.bottom;

  if (doc.y + height <= bottom) {
    return false;
  }

  doc.addPage();
  return true;
}

/**
 * Draws a continued section title.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {string} title - Section title.
 * @returns {void}
 */
function sectionTitle(doc, title) {
  ensureSpace(doc, 26);
  doc.moveDown(0.5);
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text(sanitizeText(title), { width: contentWidth(doc) });
  doc.moveDown(0.25);
}

/**
 * Draws a label/value pair.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {string} label - Bold label.
 * @param {unknown} value - Value.
 * @returns {void}
 */
function keyValue(doc, label, value) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor("#1a1a1a");
  doc.text(`${sanitizeText(label)}: `, { continued: true });
  doc
    .font("Helvetica")
    .fillColor("#333")
    .text(sanitizeText(value ?? "-"));
}

/**
 * Draws the emitter header: logo when available, name, RIF, address, phone and
 * email. Invalid logo data is ignored instead of failing the document.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object} company - Emitter profile.
 * @returns {void}
 */
function companyHeader(doc, company) {
  const left = doc.page.margins.left;
  const startY = doc.y;
  let textLeft = left;

  if (company.logo) {
    try {
      doc.image(company.logo, left, startY, { fit: [70, 50] });
      textLeft = left + 85;
    } catch (error) {
      textLeft = left;
    }
  }

  const width = contentWidth(doc) - (textLeft - left);

  doc
    .font("Helvetica-Bold")
    .fontSize(15)
    .fillColor("#1a1a1a")
    .text(sanitizeText(company.name), textLeft, startY, { width });
  doc.font("Helvetica").fontSize(8).fillColor("#333");
  doc.text(`RIF: ${sanitizeText(company.taxId)}`, textLeft, doc.y, { width });
  doc.text(sanitizeText(company.address), textLeft, doc.y, { width });

  if (company.phone) {
    doc.text(`Teléfono: ${sanitizeText(company.phone)}`, textLeft, doc.y, {
      width,
    });
  }

  if (company.email) {
    doc.text(`Correo: ${sanitizeText(company.email)}`, textLeft, doc.y, {
      width,
    });
  }

  doc.y = Math.max(doc.y, startY + 55);
  doc
    .moveTo(left, doc.y)
    .lineTo(left + contentWidth(doc), doc.y)
    .strokeColor("#999")
    .stroke();
  doc.moveDown(0.8);
}

/**
 * Measures the height of a table row.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object[]} columns - Column definitions with `width`.
 * @param {unknown[]} cells - Cell values.
 * @param {boolean} bold - Whether to use the bold font.
 * @returns {number} Row height.
 */
function rowHeight(doc, columns, cells, bold) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8);

  const heights = cells.map((cell, index) =>
    doc.heightOfString(sanitizeText(cell), {
      width: columns[index].width - 6,
    }),
  );

  return Math.max(...heights, 10) + 6;
}

/**
 * Paints one table row.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object[]} columns - Column definitions.
 * @param {unknown[]} cells - Cell values.
 * @param {object} [options] - Row options.
 * @param {boolean} [options.bold] - Use the bold font.
 * @param {boolean} [options.header] - Paint the header background.
 * @returns {void}
 */
function paintRow(doc, columns, cells, { bold = false, header = false } = {}) {
  const height = rowHeight(doc, columns, cells, bold);
  const top = doc.y;
  const left = doc.page.margins.left;

  if (header) {
    doc.rect(left, top, contentWidth(doc), height).fillColor("#e8edf2").fill();
  }

  doc
    .font(bold ? "Helvetica-Bold" : "Helvetica")
    .fontSize(8)
    .fillColor("#1a1a1a");
  let x = left;

  cells.forEach((cell, index) => {
    const column = columns[index];
    const align = column.align ?? "left";
    const text = sanitizeText(cell);

    doc.text(text, x + 3, top + 3, {
      width: column.width - 6,
      align,
      lineBreak: true,
    });
    x += column.width;
  });

  doc.y = top + height;
}

/**
 * Draws a table with repeated headers across pages.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {object[]} columns - Columns with `label`, `width` and optional `align`.
 * @param {Array<Array<unknown>>} rows - Table rows.
 * @returns {void}
 */
function table(doc, columns, rows) {
  const labels = columns.map((column) => column.label);
  const headerHeight = rowHeight(doc, columns, labels, true);

  ensureSpace(doc, headerHeight + 20);
  paintRow(doc, columns, labels, { bold: true, header: true });

  rows.forEach((row) => {
    const height = rowHeight(doc, columns, row, false);

    if (ensureSpace(doc, height)) {
      paintRow(doc, columns, labels, { bold: true, header: true });
    }

    paintRow(doc, columns, row);
  });

  doc.moveDown(0.6);
}

/**
 * Adds the footer and page numbers, then ends the document.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @param {string} footer - Footer text.
 * @returns {void}
 */
function finalize(doc, footer) {
  const range = doc.bufferedPageRange();

  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    const y = doc.page.height - FOOTER_Y_OFFSET;
    const left = doc.page.margins.left;
    const width = contentWidth(doc);

    doc
      .font("Helvetica")
      .fontSize(7)
      .fillColor("#555")
      .text(sanitizeText(footer), left, y, {
        width,
        align: "left",
        lineBreak: false,
      });

    if (range.count > 1) {
      doc.text(`Página ${index + 1} de ${range.count}`, left, y, {
        width,
        align: "right",
        lineBreak: false,
      });
    }
  }

  doc.end();
}

/**
 * Collects the generated document into a buffer.
 * @param {PDFKit.PDFDocument} doc - PDF document.
 * @returns {Promise<Buffer>} The PDF bytes.
 */
function toBuffer(doc) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

module.exports = {
  companyHeader,
  contentWidth,
  createDocument,
  ensureSpace,
  finalize,
  keyValue,
  sectionTitle,
  table,
  toBuffer,
};
