const { Router } = require("express");
const { detailAccess } = require("../invoices/guards");
const { handleInvoiceError } = require("../invoices/shared");
const { parsePositiveInteger } = require("../shared/parsers");
const { loadCompanyProfile } = require("./company");
const { invoiceFilename, parseDownloadFlag, sendPdf } = require("./delivery");
const { invoiceDocumentService } = require("./invoice");
const { renderInvoicePdf } = require("./pdf");

const router = Router();

/**
 * @openapi
 * /invoices/{id}/pdf:
 *   get:
 *     summary: Downloads the PDF of an issued invoice
 *     description: >
 *       Generates the PDF of an immutable invoice in its registered currency,
 *       without conversion. It shows the snapshot lines, subtotal, tax, total,
 *       paid amount, balance due, payment status and the summarized payment
 *       history when it exists. Customers can only download their own
 *       invoices; another customer's invoice answers 404. The document is NOT
 *       a fiscal invoice and its number is internal.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 7
 *       - in: query
 *         name: download
 *         required: false
 *         schema: { type: boolean, default: false }
 *         description: true sends Content-Disposition attachment instead of inline
 *     produces:
 *       - application/pdf
 *     responses:
 *       200:
 *         description: Invoice PDF
 *         content:
 *           application/pdf:
 *             schema: { type: string, format: binary }
 *       401:
 *         description: Missing, invalid or expired token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       403:
 *         description: Role without permission, blocked user or unlinked customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *       404:
 *         description: Invoice not found or owned by another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Invoice not found }
 *       422:
 *         description: Invalid invoice id or download flag
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       503:
 *         description: Missing company profile
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Company profile is not configured }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/pdf", ...detailAccess(), async (req, res) => {
  const id = parsePositiveInteger(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid invoice id" } });
  }

  const download = parseDownloadFlag(req.query.download);

  if (download === undefined) {
    return res.status(422).json({ errors: { download: "Invalid download" } });
  }

  try {
    const company = loadCompanyProfile();
    const data = await invoiceDocumentService.getInvoiceDocument(id, req.user);
    const buffer = await renderInvoicePdf(data, company);

    return sendPdf(res, buffer, {
      filename: invoiceFilename(data),
      download,
    });
  } catch (error) {
    return handleInvoiceError(error, res);
  }
});

module.exports = router;
