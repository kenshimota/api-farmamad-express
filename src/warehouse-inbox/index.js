const { Router } = require("express");
const listRouter = require("./list");
const productLotsRouter = require("./product-lots");
const startRouter = require("./start");
const locationRouter = require("./location");

const router = Router();

router.use(listRouter);
router.use(productLotsRouter);
router.use(startRouter);
router.use(locationRouter);

module.exports = router;
