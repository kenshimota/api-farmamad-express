jest.mock("../database", () => ({
  authenticate: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const sequelize = require("../database");
const healthRouter = require("./index");

const app = express();
app.use("/health", healthRouter);

describe("GET /health", () => {
  it("responds 200 when the database is reachable", async () => {
    sequelize.authenticate.mockResolvedValue();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "up" });
  });

  it("responds 503 when the database is unreachable", async () => {
    sequelize.authenticate.mockRejectedValue(new Error("connection refused"));

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "error", database: "down" });
  });
});
