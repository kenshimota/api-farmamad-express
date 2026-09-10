const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const helloRouter = require("./hello");
const healthRouter = require("./health");
const authRouter = require("./auth");
const usersRouter = require("./users");

const app = express();

app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/hello-world", helloRouter);
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);

module.exports = app;
