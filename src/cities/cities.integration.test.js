process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const City = require("../models/city");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  STATE_BODY,
  as,
  createCity,
  createState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/cities");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("POST /cities with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a city and answers 201",
    async (role) => {
      const state = await createState();
      const token = await tokenFor(role);

      const response = await as("post", "/cities", token).send({
        ...BODY,
        state_id: state.id,
      });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: expect.any(Number),
        name: "Maracay",
        state_id: state.id,
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await City.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
      expect(stored.state_id).toBe(state.id);
    },
  );

  it("trims the name before storing it", async () => {
    const state = await createState();
    const token = await tokenFor("admin");

    const response = await as("post", "/cities", token).send({
      name: "  Maracay  ",
      state_id: state.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Maracay");
  });

  it("responds 422 when the state does not exist", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/cities", token).send({
      name: "Maracay",
      state_id: 99999,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { state_id: "Invalid state" },
    });
  });

  it("responds 409 for a duplicated city in the same state", async () => {
    const state = await createState();
    await createCity({ name: "Maracay", state_id: state.id });
    const token = await tokenFor("admin");

    const response = await as("post", "/cities", token).send({
      name: "Maracay",
      state_id: state.id,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "City already exists" });
  });

  it("allows the same city name in a different state", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    await createCity({ name: "Maracay", state_id: aragua.id });
    const token = await tokenFor("admin");

    const response = await as("post", "/cities", token).send({
      name: "Maracay",
      state_id: carabobo.id,
    });

    expect(response.status).toBe(201);
    expect(response.body.state_id).toBe(carabobo.id);
  });

  it("responds 400 when name or state_id is missing", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/cities", token).send({});

    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({
      message: "name and state_id are required",
    });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/cities").send(STATE_BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const state = await createState();
      const token = await tokenFor(role);

      const response = await as("post", "/cities", token).send({
        ...BODY,
        state_id: state.id,
      });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );
});

describe("GET /cities with a real database", () => {
  it("returns the cities ordered by id with public fields only", async () => {
    const state = await createState();
    const first = await createCity({ name: "Maracay", state_id: state.id });
    const second = await createCity({ name: "Turmero", state_id: state.id });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/cities", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: first.id, name: "Maracay", state_id: state.id },
      { id: second.id, name: "Turmero", state_id: state.id },
    ]);
    expect(response.body[0]).not.toHaveProperty("state");
  });

  it("filters by state_id with an exact match", async () => {
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const carabobo = await createState({ name: "Carabobo", code: "VE-G" });
    const maracay = await createCity({
      name: "Maracay",
      state_id: aragua.id,
    });
    await createCity({ name: "Valencia", state_id: carabobo.id });
    const token = await tokenFor("admin");

    const response = await as("get", `/cities?state_id=${aragua.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: maracay.id, name: "Maracay", state_id: aragua.id },
    ]);
  });

  it("nests the state only when include=state is requested", async () => {
    const state = await createState();
    const city = await createCity({ name: "Maracay", state_id: state.id });
    const token = await tokenFor("customer");

    const plain = await as("get", "/cities", token);
    expect(plain.body[0]).not.toHaveProperty("state");

    const nested = await as("get", "/cities?include=state", token);
    expect(nested.status).toBe(200);
    expect(nested.body).toEqual([
      {
        id: city.id,
        name: "Maracay",
        state_id: state.id,
        state: { id: state.id, name: "Aragua", code: "VE-D" },
      },
    ]);
  });

  it("responds 422 when the state_id filter is invalid", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/cities?state_id=abc", token);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { state_id: "Invalid state" },
    });
  });

  it("returns an empty array when there are no cities", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/cities", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});

describe("GET /cities/:id with a real database", () => {
  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read one city", async (role) => {
    const state = await createState();
    const city = await createCity({ name: "Maracay", state_id: state.id });
    const token = await tokenFor(role);

    const response = await as("get", `/cities/${city.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      id: city.id,
      name: "Maracay",
      state_id: state.id,
    });
    expect(response.body).not.toHaveProperty("state");
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/cities/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "City not found" });

    const invalid = await as("get", "/cities/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid city id" },
    });
  });
});
