const { Router } = require("express");
const listRouter = require("./list");
const productListRouter = require("./product-list");
const availableRouter = require("./available");
const detailRouter = require("./detail");

const router = Router();

router.use(listRouter);
router.use(productListRouter);
router.use(availableRouter);
router.use(detailRouter);

module.exports = router;
