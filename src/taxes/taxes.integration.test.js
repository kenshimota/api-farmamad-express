process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const Tax = require("../models/tax");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createTax,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/taxes");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("POST and GET /taxes with a real database", () => {
  it("creates a tax, normalizes the code and defaults is_active", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/taxes", token).send({
      code: " iva ",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      id: expect.any(Number),
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
      is_active: true,
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");

    const stored = await Tax.findByPk(response.body.id);
    expect(stored.code).toBe("IVA");
    expect(Number(stored.rate)).toBe(16);
  });

  it("allows several taxes with different rates and accepts 0 and 100", async () => {
    await createTax({ code: "IGTF", rate: "3.00" });
    const token = await tokenFor("admin");

    const zero = await as("post", "/taxes", token).send({
      code: "ZERO",
      name: "Exento",
      rate: 0,
    });
    const hundred = await as("post", "/taxes", token).send({
      code: "MAX",
      name: "Máximo",
      rate: 100,
    });

    expect(zero.status).toBe(201);
    expect(zero.body.rate).toBe(0);
    expect(hundred.status).toBe(201);
    expect(hundred.body.rate).toBe(100);
    await expect(Tax.count()).resolves.toBe(3);
  });

  it("rejects a duplicated code ignoring case", async () => {
    await createTax({ code: "IVA" });
    const token = await tokenFor("admin");

    const response = await as("post", "/taxes", token).send({
      code: "iva",
      name: "Otro IVA",
      rate: 16,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Tax already exists" });
  });

  it("enforces the unique functional index and the rate check in the database", async () => {
    await createTax({ code: "IVA" });

    await expect(
      Tax.create({
        code: "iva",
        name: "Duplicado",
        rate: "16.00",
      }),
    ).rejects.toThrow(UniqueConstraintError);

    await expect(
      Tax.create({ code: "HIGH", name: "Alto", rate: "100.01" }),
    ).rejects.toThrow();
    await expect(
      Tax.create({ code: "LOW", name: "Bajo", rate: "-0.01" }),
    ).rejects.toThrow();
  });

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/taxes", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "code, name and rate are required",
    });

    const range = await as("post", "/taxes", token).send({
      code: "BAD",
      name: "Fuera de rango",
      rate: 101,
    });
    expect(range.status).toBe(422);
    expect(range.body).toEqual({
      errors: { rate: "rate must be between 0 and 100" },
    });

    const decimals = await as("post", "/taxes", token).send({
      code: "DEC",
      name: "Decimales",
      rate: 16.123,
    });
    expect(decimals.status).toBe(422);
    expect(decimals.body).toEqual({
      errors: { rate: "rate must have at most 2 decimals" },
    });
  });

  it("lists taxes ordered by code and filters by is_active", async () => {
    const iva = await createTax({
      code: "IVA",
      rate: "16.00",
      is_active: true,
    });
    const igtf = await createTax({ code: "IGTF", rate: "3.00" });
    const exento = await createTax({
      code: "EXENTO",
      rate: "0.00",
      is_active: false,
    });
    const token = await tokenFor("dispatcher");

    const all = await as("get", "/taxes", token);
    expect(all.status).toBe(200);
    expect(all.body.map((row) => row.code)).toEqual(["EXENTO", "IGTF", "IVA"]);
    expect(all.body.map((row) => row.rate)).toEqual([0, 3, 16]);

    const active = await as("get", "/taxes?is_active=true", token);
    expect(active.body.map((row) => row.id)).toEqual([igtf.id, iva.id]);

    const inactive = await as("get", "/taxes?is_active=false", token);
    expect(inactive.body.map((row) => row.id)).toEqual([exento.id]);
  });

  it("returns the detail and validates ids and filters", async () => {
    const tax = await createTax({ code: "IVA" });
    const token = await tokenFor("seller");

    const detail = await as("get", `/taxes/${tax.id}`, token);
    expect(detail.status).toBe(200);
    expect(detail.body).toEqual({
      id: tax.id,
      code: "IVA",
      name: "Impuesto al Valor Agregado",
      rate: 16,
      description: "IVA general",
      is_active: true,
    });

    const missing = await as("get", "/taxes/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Tax not found" });

    const invalidId = await as("get", "/taxes/abc", token);
    expect(invalidId.status).toBe(422);
    expect(invalidId.body).toEqual({ errors: { id: "Invalid tax id" } });

    const invalidFilter = await as("get", "/taxes?is_active=maybe", token);
    expect(invalidFilter.status).toBe(422);
    expect(invalidFilter.body).toEqual({
      errors: { is_active: "Invalid is_active" },
    });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const anonymous = await request(app).get("/taxes");
    expect(anonymous.status).toBe(401);

    const support = await tokenFor("support");
    const forbidden = await as("get", "/taxes", support);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});
