const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");
const cors = require("./config/cors");
const requestId = require("./middleware/request-id");
const requestLogger = require("./middleware/request-logger");
const notFound = require("./middleware/not-found");
const errorHandler = require("./middleware/error-handler");
const helloRouter = require("./hello");
const healthRouter = require("./health");
const authRouter = require("./auth");
const usersRouter = require("./users");
const rolesRouter = require("./roles");
const customersRouter = require("./customers");
const warehousesRouter = require("./warehouses");
const categoriesRouter = require("./categories");

const app = express();

app.use(requestId);
app.use(requestLogger);
// CORS runs before the JSON parser so preflights are answered without body
// parsing and every response, including parser errors, carries CORS headers.
app.use(cors);
app.use(express.json());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use("/hello-world", helloRouter);
app.use("/health", healthRouter);
app.use("/auth", authRouter);
app.use("/users", usersRouter);
app.use("/roles", rolesRouter);
app.use("/customers", customersRouter);
app.use("/warehouses", warehousesRouter);
app.use("/categories", categoriesRouter);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
