const { Router } = require("express");
const listRouter = require("./list");
const detailRouter = require("./detail");

const router = Router();

router.use("/products", listRouter);
router.use("/products", detailRouter);

module.exports = router;
