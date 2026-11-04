const { Router } = require("express");
const { orderAccess } = require("../orders/guards");
const { handleOrderError } = require("../orders/shared");
const { parsePositiveInteger } = require("../shared/parsers");
const { loadCompanyProfile } = require("./company");
const { quotationFilename, parseDownloadFlag, sendPdf } = require("./delivery");
const { renderQuotationPdf } = require("./pdf");
const { quotationService } = require("./quotation");

const router = Router();

/**
 * @openapi
 * /orders/{id}/quotation:
 *   get:
 *     summary: Downloads the quotation PDF of an order
 *     description: >
 *       Generates an informative quotation for an order in `draft`, `request`
 *       or `generate`. The document uses the order currency by default or the
 *       active currency sent in `?currency_id=`. Conversion is read-only:
 *       `exchange_rate = round6(source.rate / target.rate)`, unit prices and
 *       subtotals use `round2` and the total is `round2(total * rate)`. The
 *       order is never modified. An `invoiced` order answers 409 ("Order is
 *       already invoiced") and a cancelled one 409 ("Order is cancelled").
 *       The PDF is informative and NOT a fiscal document.
 *     tags:
 *       - Documents
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 10
 *       - in: query
 *         name: currency_id
 *         required: false
 *         schema: { type: integer, minimum: 1 }
 *         description: Active target currency; defaults to the order currency
 *       - in: query
 *         name: download
 *         required: false
 *         schema: { type: boolean, default: false }
 *         description: true sends Content-Disposition attachment instead of inline
 *     produces:
 *       - application/pdf
 *     responses:
 *       200:
 *         description: Quotation PDF
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
 *         description: Order or target currency not found, or another customer's order
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order not found }
 *       409:
 *         description: Order already invoiced or cancelled
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Order is already invoiced }
 *       422:
 *         description: Invalid id, currency, download flag or order without lines
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *       503:
 *         description: Missing company profile or incomplete currency configuration
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Company profile is not configured }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id/quotation", ...orderAccess(), async (req, res) => {
  const id = parsePositiveInteger(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid order id" } });
  }

  const download = parseDownloadFlag(req.query.download);

  if (download === undefined) {
    return res.status(422).json({ errors: { download: "Invalid download" } });
  }

  let currencyId;

  if (req.query.currency_id !== undefined) {
    currencyId = parsePositiveInteger(req.query.currency_id);

    if (currencyId === null) {
      return res
        .status(422)
        .json({ errors: { currency_id: "Invalid currency" } });
    }
  }

  try {
    const company = loadCompanyProfile();
    const data = await quotationService.getQuotation(id, req.user, {
      currencyId,
    });
    const buffer = await renderQuotationPdf(data, company);

    return sendPdf(res, buffer, {
      filename: quotationFilename(data),
      download,
    });
  } catch (error) {
    return handleOrderError(error, res);
  }
});

module.exports = router;
