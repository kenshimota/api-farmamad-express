const { Router } = require("express");

const router = Router();

/**
 * @openapi
 * /hello-world:
 *   get:
 *     summary: Returns a hello world message
 *     tags:
 *       - Hello
 *     responses:
 *       200:
 *         description: Hello world message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello World
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get("/", (req, res) => {
  res.json({ message: "Hello World" });
});

module.exports = router;
