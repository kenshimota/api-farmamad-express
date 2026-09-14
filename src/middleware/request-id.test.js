const express = require("express");
const request = require("supertest");
const requestId = require("./request-id");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Builds a tiny app exposing the id assigned by the middleware.
 *
 * @returns {import("express").Express}
 */
function buildApp() {
  const app = express();
  app.use(requestId);
  app.get("/", (req, res) => res.json({ requestId: req.requestId }));
  return app;
}

describe("request-id middleware", () => {
  it("assigns a UUID and echoes it in the response header", async () => {
    const response = await request(buildApp()).get("/");

    expect(response.body.requestId).toMatch(UUID_PATTERN);
    expect(response.headers["x-request-id"]).toBe(response.body.requestId);
  });

  it("keeps the client provided X-Request-Id", async () => {
    const response = await request(buildApp())
      .get("/")
      .set("X-Request-Id", "client-request-1");

    expect(response.body.requestId).toBe("client-request-1");
    expect(response.headers["x-request-id"]).toBe("client-request-1");
  });

  it("generates a new id when the header is empty", async () => {
    const response = await request(buildApp()).get("/").set("X-Request-Id", "");

    expect(response.body.requestId).toMatch(UUID_PATTERN);
  });

  it("generates a new id when the header is only whitespace", () => {
    const req = { headers: { "x-request-id": "   " } };
    const res = { setHeader: jest.fn() };
    const next = jest.fn();

    requestId(req, res, next);

    expect(req.requestId).toMatch(UUID_PATTERN);
    expect(res.setHeader).toHaveBeenCalledWith("X-Request-Id", req.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
