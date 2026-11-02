const { Router } = require("express");
const listRouter = require("./list");
const detailRouter = require("./detail");
const transactionsRouter = require("./transactions");

const router = Router();

router.use(listRouter);
router.use(transactionsRouter);
router.use(detailRouter);

module.exports = router;
