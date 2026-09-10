const { Router } = require("express");
const sequelize = require("../database");

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     summary: Reports API and database health
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API and database are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 database:
 *                   type: string
 *                   example: up
 *       503:
 *         description: Database is unreachable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: error
 *                 database:
 *                   type: string
 *                   example: down
 */
router.get("/", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    res.status(503).json({ status: "error", database: "down" });
  }
});

module.exports = router;
