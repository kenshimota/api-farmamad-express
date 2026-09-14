const express = require("express");
const request = require("supertest");
const logger = require("../config/logger");
const requestId = require("./request-id");
const requestLogger = require("./request-logger");

/**
 * Builds an app that always answers with the given status.
 *
 * @param {number} status
 * @returns {import("express").Express}
 */
function buildApp(status) {
  const app = express();
  app.use(express.json());
  app.use(requestId);
  app.use(requestLogger);
  app.all("/thing", (req, res) =>
    res.status(status).json({ ok: status < 400 }),
  );
  return app;
}

describe("request-logger middleware", () => {
  let infoSpy;
  let warnSpy;

  beforeEach(() => {
    infoSpy = jest.spyOn(logger, "info").mockImplementation(() => {});
    warnSpy = jest.spyOn(logger, "warn").mockImplementation(() => {});
  });

  it("logs successful requests with logger.info including requestId", async () => {
    await request(buildApp(200)).get("/thing");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    const [message, context] = infoSpy.mock.calls[0];
    expect(message).toContain("200");
    expect(message).toContain("GET");
    expect(message).toContain("/thing");
    expect(context).toMatchObject({ requestId: expect.any(String) });
  });

  it("logs 4xx responses with logger.warn", async () => {
    await request(buildApp(404)).get("/thing");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs the first 4xx status (400) with logger.warn", async () => {
    await request(buildApp(400)).get("/thing");

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("logs 5xx responses with logger.info, not warn", async () => {
    await request(buildApp(500)).get("/thing");

    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not log the body nor sensitive headers", async () => {
    await request(buildApp(200))
      .post("/thing")
      .set("Authorization", "Bearer top-secret")
      .set("Cookie", "session=top-secret")
      .send({ password: "secreto123" });

    const [message, context] = infoSpy.mock.calls[0];
    const logged = JSON.stringify([message, context]);
    expect(logged).not.toContain("top-secret");
    expect(logged).not.toContain("secreto123");
  });
});
