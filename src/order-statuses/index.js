const { Router } = require("express");
const readRouter = require("./read");
const writeRouter = require("./write");

const router = Router();

// Reads are available to every authenticated customer, admin and seller;
// writes are restricted to administrators inside the routers.
router.use(readRouter);
router.use(writeRouter);

module.exports = router;
