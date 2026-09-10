const express = require("express");
const helloRouter = require("./hello");
const healthRouter = require("./health");

const app = express();

app.use(express.json());
app.use("/hello-world", helloRouter);
app.use("/health", healthRouter);

module.exports = app;
