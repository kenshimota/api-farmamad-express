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

jest.mock("./models/category", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/image", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/product", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/city", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/item-state", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/cost", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));

jest.mock("./models/stock", () => ({
  findAll: jest.fn(),
  findByPk: jest.fn(),
  findOne: jest.fn(),
  findOrCreate: jest.fn(),
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

  it("exposes POST /categories behind authentication", async () => {
    const response = await request(app).post("/categories").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("exposes POST /images behind authentication", async () => {
    const response = await request(app).post("/images").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("exposes POST /suppliers behind authentication", async () => {
    const response = await request(app).post("/suppliers").send({});

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("exposes GET /stocks behind authentication", async () => {
    const response = await request(app).get("/stocks");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it("does not expose public stock writes", async () => {
    const response = await request(app).post("/stocks").send({ quantity: 1 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Not found" });
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
