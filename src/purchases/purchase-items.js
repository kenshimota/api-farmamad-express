const { Router } = require("express");
const listRouter = require("./item-list");
const createRouter = require("./item-create");
const updateRouter = require("./item-update");
const removeRouter = require("./item-remove");

const router = Router();

router.use(listRouter);
router.use(createRouter);
router.use(updateRouter);
router.use(removeRouter);

module.exports = router;
