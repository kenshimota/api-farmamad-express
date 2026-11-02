const { Router } = require("express");
const { toPublicInvoice } = require("./serializer");
const { detailAccess } = require("./guards");
const { invoiceService } = require("./service");
const { handleInvoiceError } = require("./shared");
const { parseInvoiceId } = require("./parsers");

const router = Router();

/**
 * @openapi
 * /invoices/{id}:
 *   get:
 *     summary: Returns one invoice with its snapshot lines
 *     description: >
 *       Administrators and sellers can read any invoice and receive the
 *       internal `invoiced_by` user. A customer can only read an invoice of
 *       their own `customer_id`; another customer's invoice answers 404 so its
 *       existence is not revealed. `balance_due` is `total - paid_amount`.
 *     tags:
 *       - Invoices
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *         example: 1
 *     responses:
 *       200:
 *         description: Invoice detail with its lines
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/InvoiceDetail' }
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
 *         description: The invoice does not exist or belongs to another customer
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorMessage' }
 *             example: { message: Invoice not found }
 *       422:
 *         description: Invalid invoice id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ValidationErrors' }
 *             example: { errors: { id: Invalid invoice id } }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/:id", ...detailAccess(), async (req, res) => {
  const id = parseInvoiceId(req.params.id);

  if (id === null) {
    return res.status(422).json({ errors: { id: "Invalid invoice id" } });
  }

  try {
    const invoice = await invoiceService.getInvoice(id, req.user);

    return res.json(
      toPublicInvoice(invoice, {
        includeItems: true,
        includeInvoicedBy: ["admin", "seller"].includes(req.user.role),
      }),
    );
  } catch (error) {
    return handleInvoiceError(error, res);
  }
});

module.exports = router;
