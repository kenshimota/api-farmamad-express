const { Router } = require("express");
const sequelize = require("../database");
const logger = require("../config/logger");

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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: "ok", database: "up" });
  } catch (error) {
    logger.error("Database health check failed", {
      database: "down",
      message: error && error.message,
      stack: error && error.stack,
      requestId: req.requestId,
    });
    res.status(503).json({ status: "error", database: "down" });
  }
});

module.exports = router;
