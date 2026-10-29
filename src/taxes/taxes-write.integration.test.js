process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
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

describe("PUT /taxes/:id with a real database", () => {
  it("updates the editable fields and answers 202", async () => {
    const tax = await createTax({ code: "IGTF", rate: "3.00" });
    const token = await tokenFor("admin");

    const response = await as("put", `/taxes/${tax.id}`, token).send({
      rate: 3.5,
      is_active: false,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: tax.id,
      code: "IGTF",
      name: "Impuesto al Valor Agregado",
      rate: 3.5,
      description: "IVA general",
      is_active: false,
    });

    const stored = await Tax.findByPk(tax.id);
    expect(Number(stored.rate)).toBe(3.5);
    expect(stored.is_active).toBe(false);
  });

  it("ignores code on update because it is immutable", async () => {
    const tax = await createTax({ code: "IVA" });
    const token = await tokenFor("admin");

    const response = await as("put", `/taxes/${tax.id}`, token).send({
      code: "OTHER",
      name: "Impuesto actualizado",
    });

    expect(response.status).toBe(202);
    expect(response.body.code).toBe("IVA");
    expect(response.body.name).toBe("Impuesto actualizado");

    const stored = await Tax.findByPk(tax.id);
    expect(stored.code).toBe("IVA");
  });

  it("responds 400, 404 and 422 for invalid updates", async () => {
    const tax = await createTax();
    const token = await tokenFor("admin");

    const empty = await as("put", `/taxes/${tax.id}`, token).send({
      code: "OTHER",
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "At least one field is required",
    });

    const missing = await as("put", "/taxes/99999", token).send({
      rate: 3.5,
    });
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Tax not found" });

    const invalid = await as("put", `/taxes/${tax.id}`, token).send({
      rate: 101,
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { rate: "rate must be between 0 and 100" },
    });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const tax = await createTax();

    const anonymous = await request(app).put(`/taxes/${tax.id}`).send({
      rate: 3.5,
    });
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as("put", `/taxes/${tax.id}`, seller).send({
      rate: 3.5,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /taxes/:id with a real database", () => {
  it("deletes the tax physically and answers 204", async () => {
    const tax = await createTax();
    const token = await tokenFor("admin");

    const response = await as("delete", `/taxes/${tax.id}`, token);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    await expect(Tax.findByPk(tax.id)).resolves.toBeNull();

    const again = await as("delete", `/taxes/${tax.id}`, token);
    expect(again.status).toBe(404);
    expect(again.body).toEqual({ message: "Tax not found" });
  });

  it("responds 401 and 403 for unauthorized roles", async () => {
    const tax = await createTax();

    const anonymous = await request(app).delete(`/taxes/${tax.id}`);
    expect(anonymous.status).toBe(401);

    const seller = await tokenFor("seller");
    const forbidden = await as("delete", `/taxes/${tax.id}`, seller);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });

    const stored = await Tax.findByPk(tax.id);
    expect(stored).not.toBeNull();
  });
});
