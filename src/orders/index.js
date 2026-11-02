const { Router } = require("express");
const createRouter = require("./create");
const readRouter = require("./read");
const itemsRouter = require("./items-router");
const editRouter = require("./edit");
const statusRouter = require("./status");
const paymentTermRouter = require("./payment-term");

const router = Router();

// The specific `/items`, `/status` and `/payment-term` routes are mounted
// before the generic `/:id` reads so the intended handler always wins.
router.use(createRouter);
router.use(itemsRouter);
router.use(statusRouter);
router.use(paymentTermRouter);
router.use(editRouter);
router.use(readRouter);

module.exports = router;
