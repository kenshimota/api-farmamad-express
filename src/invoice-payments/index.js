const { Router } = require("express");
const applyRouter = require("./apply");
const listRouter = require("./list");

const router = Router();

// Allocations are immutable: only applying a payment and reading the history
// are exposed. There is intentionally no PUT or DELETE endpoint.
router.use(applyRouter);
router.use(listRouter);

module.exports = router;
