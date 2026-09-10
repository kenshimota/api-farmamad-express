const { Router } = require("express");
const sequelize = require("../database");

const router = Router();

router.get("/", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    res.status(503).json({ status: "error", database: "down" });
  }
});

module.exports = router;
