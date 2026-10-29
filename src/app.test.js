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
  findAll: jest.fn(),
}));

jest.mock("./models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

jest.mock("./models/customer", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/warehouse", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

const request = require("supertest");
const app = require("./app");
const logger = require("./config/logger");
const User = require("./models/user");

const ORIGINAL_CORS_ORIGIN = process.env.CORS_ORIGIN;

describe("app", () => {
  let errorSpy;

  beforeEach(() => {
    delete process.env.CORS_ORIGIN;
    jest.spyOn(logger, "info").mockImplementation(() => {});
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    errorSpy = jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    if (ORIGINAL_CORS_ORIGIN === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL_CORS_ORIGIN;
    }
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

  it("exposes GET /roles behind authentication", async () => {
    const response = await request(app).get("/roles");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("exposes POST /customers behind authentication", async () => {
    const response = await request(app).post("/customers").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("exposes POST /warehouses behind authentication", async () => {
    const response = await request(app).post("/warehouses").send({});

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

  it("adds CORS headers to successful responses", async () => {
    const response = await request(app).get("/hello-world");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-expose-headers"]).toBe(
      "X-Request-Id",
    );
  });

  it("adds CORS headers to 401 responses", async () => {
    const response = await request(app).post("/users").send({});

    expect(response.status).toBe(401);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("adds CORS headers to 404 responses", async () => {
    const response = await request(app).get("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("adds CORS headers to 500 responses", async () => {
    User.findOne.mockRejectedValueOnce(new Error("connection refused"));

    const response = await request(app)
      .post("/auth/login")
      .send({ identifier: "juan@example.com", password: "secreto123" });

    expect(response.status).toBe(500);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("answers the CORS preflight for a known route with 204", async () => {
    const response = await request(app)
      .options("/users")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .set("Access-Control-Request-Headers", "authorization,content-type");

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    );
    expect(response.headers["access-control-allow-headers"]).toBe(
      "Content-Type,Authorization,X-Request-Id",
    );
    expect(response.headers["access-control-max-age"]).toBe("86400");
  });

  it("answers the CORS preflight for an unknown route with 404", async () => {
    const response = await request(app).options("/does-not-exist");

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body).toEqual({ message: "Not found" });
  });

  it("answers the CORS preflight for an unknown path under a known router with 404", async () => {
    const response = await request(app).options("/users/999/unknown");

    expect(response.status).toBe(404);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
    expect(response.body).toEqual({ message: "Not found" });
  });

  it("adds CORS headers to the swagger docs", async () => {
    const response = await request(app).get("/docs/");

    expect(response.status).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("does not enable credentials", async () => {
    const response = await request(app).get("/hello-world");

    expect(
      response.headers["access-control-allow-credentials"],
    ).toBeUndefined();
  });
});
