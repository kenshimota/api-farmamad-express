process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Supplier = require("../models/supplier");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  as,
  createCity,
  createLocation,
  createState,
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

describe("GET /suppliers/:id with a real database", () => {
  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read one supplier", async (role) => {
    const { state, city } = await createLocation();
    const supplier = await createSupplier({
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor(role);

    const response = await as("get", `/suppliers/${supplier.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: supplier.id,
      name: supplier.name,
      identification: supplier.identification,
      email: supplier.email,
      phone: supplier.phone,
      observations: supplier.observations,
      address: supplier.address,
      city_id: city.id,
      state_id: state.id,
      city: { id: city.id, name: "Maracay" },
      state: { id: state.id, name: "Aragua", code: "VE-D" },
    });
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body).not.toHaveProperty("updatedAt");
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/suppliers/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Supplier not found" });

    const invalid = await as("get", "/suppliers/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid supplier id" },
    });
  });
});

describe("PUT /suppliers/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update a supplier and answers 202",
    async (role) => {
      const { state, city } = await createLocation();
      const supplier = await createSupplier({
        city_id: city.id,
        state_id: state.id,
      });
      const token = await tokenFor(role);

      const response = await as("put", `/suppliers/${supplier.id}`, token).send(
        {
          name: "  Distribuidora Central  ",
          identification: " j-99999999-9 ",
          email: " NUEVO@LaSalud.com ",
        },
      );

      expect(response.status).toBe(202);
      expect(response.body.name).toBe("Distribuidora Central");
      expect(response.body.identification).toBe("J-99999999-9");
      expect(response.body.email).toBe("nuevo@lasalud.com");
      expect(response.body).not.toHaveProperty("city");
      expect(response.body).not.toHaveProperty("state");

      const stored = await Supplier.findByPk(supplier.id);
      expect(stored.name).toBe("Distribuidora Central");
      expect(stored.identification).toBe("J-99999999-9");
    },
  );

  it("derives the state when only city_id changes", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    const maracay = await createCity({
      name: "Maracay",
      state_id: aragua.id,
    });
    const valencia = await createCity({
      name: "Valencia",
      state_id: carabobo.id,
    });
    const supplier = await createSupplier({
      city_id: maracay.id,
      state_id: aragua.id,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/suppliers/${supplier.id}`, token).send({
      city_id: valencia.id,
    });

    expect(response.status).toBe(202);
    expect(response.body.city_id).toBe(valencia.id);
    expect(response.body.state_id).toBe(carabobo.id);

    const stored = await Supplier.findByPk(supplier.id);
    expect(stored.city_id).toBe(valencia.id);
    expect(stored.state_id).toBe(carabobo.id);
  });

  it("responds 422 when the new pair is incoherent", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    const maracay = await createCity({
      name: "Maracay",
      state_id: aragua.id,
    });
    const valencia = await createCity({
      name: "Valencia",
      state_id: carabobo.id,
    });
    const supplier = await createSupplier({
      city_id: maracay.id,
      state_id: aragua.id,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/suppliers/${supplier.id}`, token).send({
      city_id: valencia.id,
      state_id: aragua.id,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
  });

  it("responds 409 when the identification belongs to another supplier", async () => {
    const { state, city } = await createLocation();
    await createSupplier({ city_id: city.id, state_id: state.id });
    const other = await createSupplier({
      identification: "J-22222222-2",
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor("admin");

    const response = await as("put", `/suppliers/${other.id}`, token).send({
      identification: "j-12345678-9",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier already exists" });
  });

  it("responds 400, 404 and 422 for invalid requests", async () => {
    const { state, city } = await createLocation();
    const supplier = await createSupplier({
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor("admin");

    const empty = await as("put", `/suppliers/${supplier.id}`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({
      message: "At least one field is required",
    });

    const invalidFields = await as(
      "put",
      `/suppliers/${supplier.id}`,
      token,
    ).send({ email: "not-an-email" });
    expect(invalidFields.status).toBe(422);
    expect(invalidFields.body).toEqual({ errors: { email: "Email inválido" } });

    const missing = await as("put", "/suppliers/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Supplier not found" });

    const invalid = await as("put", "/suppliers/0", token).send(BODY);
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

    const response = await as("put", `/suppliers/${supplier.id}`, token).send({
      name: "Nuevo nombre",
    });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});
