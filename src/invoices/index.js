const { Router } = require("express");
const listRouter = require("./list");
const detailRouter = require("./detail");

const router = Router();

// Invoices are immutable: this module only exposes read endpoints. Creation is
// performed inside the `generate → invoiced` transition of HU-39 (#63), which
// calls `invoiceService.createInvoice`; swapping status, deleting an invoice or
// issuing a partial invoice is intentionally not exposed.
router.use(detailRouter);
router.use(listRouter);

module.exports = router;
