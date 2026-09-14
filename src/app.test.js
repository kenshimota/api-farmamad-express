jest.mock("./database", () => ({
  authenticate: jest.fn().mockResolvedValue(),
  transaction: jest.fn(),
}));

jest.mock("./models/user", () => ({
  findOne: jest.fn(),
  findByPk: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
}));

jest.mock("./models/role", () => ({
  findOne: jest.fn(),
}));

jest.mock("./models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const request = require("supertest");
const app = require("./app");
const logger = require("./config/logger");
const User = require("./models/user");

describe("app", () => {
  let errorSpy;

  beforeEach(() => {
    jest.spyOn(logger, "info").mockImplementation(() => {});
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  it("exposes GET /hello-world", async () => {
    const response = await request(app).get("/hello-world");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Hello World" });
  });

  it("exposes GET /health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "up" });
  });

  it("logs one access line per request through the request logger", async () => {
    await request(app).get("/hello-world");

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("200 GET /hello-world"),
      expect.objectContaining({ requestId: expect.any(String) }),
    );
  });

  it("exposes POST /auth/login", async () => {
    const response = await request(app).post("/auth/login").send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "identifier and password are required",
    });
  });

  it("exposes GET /auth/setup-status", async () => {
    const response = await request(app).get("/auth/setup-status");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ hasAdmin: false });
  });

  it("exposes POST /users behind authentication", async () => {
    const response = await request(app).post("/users").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("serves the swagger docs", async () => {
    const response = await request(app).get("/docs/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toMatch(/text\/html/);
  });

  it("responds 404 as JSON for unknown routes", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Not found" });
  });

  it("responds 400 as JSON for malformed JSON bodies", async () => {
    const response = await request(app)
      .post("/auth/login")
      .set("Content-Type", "application/json")
      .send("{ broken");

    expect(response.status).toBe(400);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Invalid JSON body" });
  });

  it("responds 500 with the generic message, JSON content type and request id", async () => {
    User.findOne.mockRejectedValueOnce(new Error("connection refused"));

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "juan@example.com", password: "secreto123" });

    expect(response.status).toBe(500);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.body).toEqual({ message: "Internal server error" });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
