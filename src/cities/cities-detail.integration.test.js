process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { DataTypes } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const City = require("../models/city");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  as,
  createCity,
  createState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/cities");

const USAGE_TABLE = "city_usage_hu16";

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

/**
 * Creates a throwaway table with a real restrictive foreign key to cities so
 * the 409 response of the delete endpoint can be exercised before the
 * suppliers table exists (HU-17).
 * @returns {Promise<void>}
 */
async function createUsageTable() {
  const queryInterface = sequelize.getQueryInterface();

  await queryInterface.createTable(USAGE_TABLE, {
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    city_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  });
  await queryInterface.addConstraint(USAGE_TABLE, {
    fields: ["city_id"],
    type: "foreign key",
    name: "city_usage_hu16_city_id_fkey",
    references: { table: "cities", field: "id" },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
}

describe("PUT /cities/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the city and answers 202",
    async (role) => {
      const state = await createState();
      const city = await createCity({ name: "Maracay", state_id: state.id });
      const token = await tokenFor(role);

      const response = await as("put", `/cities/${city.id}`, token).send({
        name: "Turmero",
      });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: city.id,
        name: "Turmero",
        state_id: state.id,
      });

      const stored = await City.findByPk(city.id);
      expect(stored.name).toBe("Turmero");
    },
  );

  it("moves the city to another state when state_id changes", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    const city = await createCity({ name: "Maracay", state_id: aragua.id });
    const token = await tokenFor("admin");

    const response = await as("put", `/cities/${city.id}`, token).send({
      state_id: carabobo.id,
    });

    expect(response.status).toBe(202);
    expect(response.body).toEqual({
      id: city.id,
      name: "Maracay",
      state_id: carabobo.id,
    });
  });

  it("responds 422 when the new state does not exist", async () => {
    const city = await createCity();
    const token = await tokenFor("admin");

    const response = await as("put", `/cities/${city.id}`, token).send({
      state_id: 99999,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { state_id: "Invalid state" },
    });
  });

  it("responds 409 when the pair already exists in the target state", async () => {
    const state = await createState();
    await createCity({ name: "Maracay", state_id: state.id });
    const other = await createCity({ name: "Turmero", state_id: state.id });
    const token = await tokenFor("seller");

    const response = await as("put", `/cities/${other.id}`, token).send({
      name: "Maracay",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "City already exists" });
  });

  it("responds 400, 404 and 422 for invalid requests", async () => {
    const city = await createCity();
    const token = await tokenFor("admin");

    const empty = await as("put", `/cities/${city.id}`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "name or state_id is required",
    });

    const missing = await as("put", "/cities/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "City not found" });

    const invalid = await as("put", "/cities/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid city id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const city = await createCity();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/cities/${city.id}`, token).send(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /cities/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete a city and answers 204",
    async (role) => {
      const city = await createCity();
      const token = await tokenFor(role);

      const response = await as("delete", `/cities/${city.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(City.findByPk(city.id)).resolves.toBeNull();
    },
  );

  it("responds 409 and keeps the city when a referencing row exists", async () => {
    const city = await createCity();
    const token = await tokenFor("admin");
    const queryInterface = sequelize.getQueryInterface();

    await createUsageTable();

    try {
      await queryInterface.bulkInsert(USAGE_TABLE, [{ city_id: city.id }]);

      const response = await as("delete", `/cities/${city.id}`, token);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: "City is in use" });
      await expect(City.findByPk(city.id)).resolves.not.toBeNull();
    } finally {
      await queryInterface.dropTable(USAGE_TABLE);
    }
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/cities/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "City not found" });

    const invalid = await as("delete", "/cities/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid city id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const city = await createCity();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/cities/${city.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const city = await createCity();
    const response = await request(app).delete(`/cities/${city.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
