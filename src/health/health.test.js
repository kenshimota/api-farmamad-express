jest.mock("../database", () => ({
  authenticate: jest.fn(),
}));

const express = require("express");
const request = require("supertest");
const sequelize = require("../database");
const logger = require("../config/logger");
const healthRouter = require("./index");

const app = express();
app.use("/health", healthRouter);

describe("GET /health", () => {
  let errorSpy;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  it("responds 200 when the database is reachable", async () => {
    sequelize.authenticate.mockResolvedValue();

    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "up" });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("responds 503 when the database is unreachable and logs the error", async () => {
    sequelize.authenticate.mockRejectedValue(new Error("connection refused"));

    const response = await request(app).get("/health");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "error", database: "down" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [message, context] = errorSpy.mock.calls[0];
    expect(message).toBe("Database health check failed");
    expect(context).toMatchObject({ database: "down" });
    expect(context.message).toBe("connection refused");
    expect(context.stack).toContain("connection refused");
  });
});
