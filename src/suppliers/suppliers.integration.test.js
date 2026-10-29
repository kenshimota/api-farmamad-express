process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const { UniqueConstraintError } = require("sequelize");
const app = require("../app");
const sequelize = require("../database");
const Supplier = require("../models/supplier");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_SUPPLIER,
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

describe("POST /suppliers with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a supplier and answers 201",
    async (role) => {
      const { state, city } = await createLocation();
      const token = await tokenFor(role);

      const response = await as("post", "/suppliers", token).send({
        ...BODY,
        city_id: city.id,
        state_id: state.id,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        ...PUBLIC_SUPPLIER,
        city_id: city.id,
        state_id: state.id,
      });
      expect(response.body).not.toHaveProperty("city");
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await Supplier.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
      expect(stored.identification).toBe(BODY.identification);
      expect(stored.city_id).toBe(city.id);
      expect(stored.state_id).toBe(state.id);
    },
  );

  it("normalizes identification, email and text fields before storing them", async () => {
    const { state, city } = await createLocation();
    const token = await tokenFor("admin");

    const response = await as("post", "/suppliers", token).send({
      ...BODY,
      name: "  Distribuidora La Salud C.A.  ",
      identification: " j-12345678-9 ",
      email: " VENTAS@LaSalud.com ",
      phone: " +58 212 555-1234 ",
      observations: "  Entrega los martes  ",
      address: "  Av. Principal, Galpón 4  ",
      city_id: city.id,
      state_id: state.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.identification).toBe("J-12345678-9");
    expect(response.body.email).toBe("ventas@lasalud.com");
    expect(response.body.name).toBe(BODY.name);

    const stored = await Supplier.findByPk(response.body.id);
    expect(stored.identification).toBe("J-12345678-9");
    expect(stored.email).toBe("ventas@lasalud.com");
    expect(stored.observations).toBe("Entrega los martes");
  });

  it("nests city and state when include=location is requested", async () => {
    const { state, city } = await createLocation();
    const token = await tokenFor("admin");

    const response = await as(
      "post",
      "/suppliers?include=location",
      token,
    ).send({ ...BODY, city_id: city.id, state_id: state.id });

    expect(response.status).toBe(201);
    expect(response.body.city).toEqual({ id: city.id, name: "Maracay" });
    expect(response.body.state).toEqual({
      id: state.id,
      name: "Aragua",
      code: "VE-D",
    });
  });

  it("responds 409 for a duplicated identification ignoring case", async () => {
    const { state, city } = await createLocation();
    await createSupplier({ city_id: city.id, state_id: state.id });
    const token = await tokenFor("admin");

    const response = await as("post", "/suppliers", token).send({
      ...BODY,
      identification: "j-12345678-9",
      city_id: city.id,
      state_id: state.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier already exists" });
  });

  it("enforces the case-insensitive identification in the database", async () => {
    const { state, city } = await createLocation();
    await createSupplier({
      identification: "J-12345678-9",
      city_id: city.id,
      state_id: state.id,
    });

    await expect(
      Supplier.create({
        ...BODY,
        identification: "j-12345678-9",
        city_id: city.id,
        state_id: state.id,
      }),
    ).rejects.toThrow(UniqueConstraintError);
  });

  it("allows two suppliers to share the same email", async () => {
    const { state, city } = await createLocation();
    const email = "compras@lasalud.com";
    const first = await createSupplier({
      identification: "J-11111111-1",
      email,
      city_id: city.id,
      state_id: state.id,
    });
    const second = await createSupplier({
      identification: "J-22222222-2",
      email,
      city_id: city.id,
      state_id: state.id,
    });

    expect(second.email).toBe(first.email);
  });

  it("responds 422 when the city does not belong to the state", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    const city = await createCity({ state_id: carabobo.id });
    const token = await tokenFor("admin");

    const response = await as("post", "/suppliers", token).send({
      ...BODY,
      city_id: city.id,
      state_id: aragua.id,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
  });

  it("responds 422 when the city or state does not exist", async () => {
    const { state, city } = await createLocation();
    const token = await tokenFor("admin");

    const missingCity = await as("post", "/suppliers", token).send({
      ...BODY,
      city_id: 99999,
      state_id: state.id,
    });
    expect(missingCity.status).toBe(422);
    expect(missingCity.body).toEqual({
      errors: { city_id: "Invalid city id" },
    });

    const missingState = await as("post", "/suppliers", token).send({
      ...BODY,
      identification: "J-00000000-0",
      city_id: city.id,
      state_id: 99999,
    });
    expect(missingState.status).toBe(422);
    expect(missingState.body).toEqual({
      errors: { state_id: "Invalid state" },
    });
  });

  it("responds 400 when a required field is missing", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/suppliers", token).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "name, identification, email, phone, address, city_id and state_id are required",
    });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/suppliers").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const { state, city } = await createLocation();
      const token = await tokenFor(role);

      const response = await as("post", "/suppliers", token).send({
        ...BODY,
        city_id: city.id,
        state_id: state.id,
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});
