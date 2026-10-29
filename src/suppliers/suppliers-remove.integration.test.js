process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const Supplier = require("../models/supplier");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  as,
  createLocation,
  createSupplier,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/suppliers");

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

describe("DELETE /suppliers/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete a supplier and answers 204",
    async (role) => {
      const { state, city } = await createLocation();
      const supplier = await createSupplier({
        city_id: city.id,
        state_id: state.id,
      });
      const token = await tokenFor(role);

      const response = await as("delete", `/suppliers/${supplier.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(Supplier.findByPk(supplier.id)).resolves.toBeNull();
    },
  );

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/suppliers/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Supplier not found" });

    const invalid = await as("delete", "/suppliers/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid supplier id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const { state, city } = await createLocation();
    const supplier = await createSupplier({
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/suppliers/${supplier.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const { state, city } = await createLocation();
    const supplier = await createSupplier({
      city_id: city.id,
      state_id: state.id,
    });

    const response = await request(app).delete(`/suppliers/${supplier.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
