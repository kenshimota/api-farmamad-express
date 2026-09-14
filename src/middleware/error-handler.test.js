const express = require("express");
const request = require("supertest");
const logger = require("../config/logger");
const requestId = require("./request-id");
const errorHandler = require("./error-handler");

/**
 * Builds an app whose `/boom` route is handled by the given function.
 *
 * @param {import("express").RequestHandler} handler
 * @returns {import("express").Express}
 */
function buildApp(handler) {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.get("/boom", handler);
  app.use(errorHandler);
  return app;
}

describe("error-handler middleware", () => {
  let errorSpy;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("responds 500 with the generic message and logs the error details", async () => {
    const app = buildApp(() => {
      throw new Error("connection refused");
    });

    const response = await request(app)
      .get("/boom")
      .set("X-Request-Id", "req-1");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ message: "Internal server error" });
    expect(response.headers["x-request-id"]).toBe("req-1");
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [, context] = errorSpy.mock.calls[0];
    expect(context).toMatchObject({
      message: "connection refused",
      method: "GET",
      path: "/boom",
      status: 500,
      requestId: "req-1",
    });
    expect(context.stack).toContain("connection refused");
  });

  it("never leaks the error message in production", async () => {
    process.env.NODE_ENV = "production";
    const app = buildApp(() => {
      throw new Error("database password is hunter2");
    });

    const response = await request(app).get("/boom");

    expect(response.body).toEqual({ message: "Internal server error" });
    expect(JSON.stringify(response.body)).not.toContain("hunter2");
  });

  it("adds a debug field in development", async () => {
    process.env.NODE_ENV = "development";
    const app = buildApp(() => {
      throw new Error("boom in dev");
    });

    const response = await request(app).get("/boom");

    expect(response.body).toEqual({
      message: "Internal server error",
      debug: "boom in dev",
    });
  });

  it("responds 400 for malformed JSON bodies without logging an error", async () => {
    const app = express();
    app.use(requestId);
    app.use(express.json());
    app.post("/thing", (req, res) => res.json({ ok: true }));
    app.use(errorHandler);

    const response = await request(app)
      .post("/thing")
      .set("Content-Type", "application/json")
      .send("{ not json");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "Invalid JSON body" });
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("delegates to next when the response was already sent", () => {
    const error = new Error("late failure");
    const res = { headersSent: true };
    const next = jest.fn();

    errorHandler(error, {}, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
