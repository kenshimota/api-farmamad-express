const { Router } = require("express");
const createRouter = require("./create");
const readRouter = require("./read");
const pickingRouter = require("./picking");
const itemsRouter = require("./items-router");
const editRouter = require("./edit");
const statusRouter = require("./status");
const paymentTermRouter = require("./payment-term");

const router = Router();

// The specific `/items`, `/status`, `/payment-term` and `/:id/picking` routes
// are mounted before the generic `/:id` reads so the intended handler wins.
router.use(createRouter);
router.use(itemsRouter);
router.use(statusRouter);
router.use(paymentTermRouter);
router.use(editRouter);
router.use(pickingRouter);
router.use(readRouter);

module.exports = router;
