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

describe("app CORS", () => {
  beforeEach(() => {
    delete process.env.CORS_ORIGIN;
    jest.spyOn(logger, "info").mockImplementation(() => {});
    jest.spyOn(logger, "warn").mockImplementation(() => {});
    jest.spyOn(logger, "error").mockImplementation(() => {});
  });

  afterAll(() => {
    if (ORIGINAL_CORS_ORIGIN === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL_CORS_ORIGIN;
    }
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
