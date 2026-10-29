process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const User = require("../models/user");
const State = require("../models/state");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  PUBLIC_STATE,
  as,
  createState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/states");

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

describe("POST /states with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a state and answers 201",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/states", token).send(BODY);

      expect(response.status).toBe(201);
      expect(response.body).toEqual(PUBLIC_STATE);
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");

      const stored = await State.findByPk(response.body.id);
      expect(stored.name).toBe(BODY.name);
      expect(stored.code).toBe(BODY.code);
    },
  );

  it("trims the name and stores the code in uppercase", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/states", token).send({
      name: "  Aragua  ",
      code: " ve-d ",
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Aragua");
    expect(response.body.code).toBe("VE-D");
  });

  it("discards unknown and audit fields", async () => {
    const token = await tokenFor("admin");

    const response = await as("post", "/states", token).send({
      ...BODY,
      id: 99,
      createdAt: "2026-09-01",
      updatedAt: "2026-09-01",
      admin: true,
    });

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("createdAt");
    expect(response.body.id).not.toBe(99);
  });

  it("responds 409 for a duplicated name ignoring case", async () => {
    await createState({ name: "Aragua", code: "VE-D" });
    const token = await tokenFor("admin");

    const response = await as("post", "/states", token).send({
      name: "ARAGUA",
      code: "VE-E",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "State already exists" });
  });

  it("responds 409 for a duplicated code", async () => {
    await createState({ name: "Aragua", code: "VE-D" });
    const token = await tokenFor("admin");

    const response = await as("post", "/states", token).send({
      name: "Carabobo",
      code: "VE-D",
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "State already exists" });
  });

  it("responds 401 without a token", async () => {
    const response = await request(app).post("/states").send(BODY);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });

  it.each(["dispatcher", "manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const token = await tokenFor(role);

      const response = await as("post", "/states", token).send(BODY);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 400 and 422 for missing and invalid fields", async () => {
    const token = await tokenFor("admin");

    const missing = await as("post", "/states", token).send({});
    expect(missing.status).toBe(400);
    expect(missing.body).toEqual({ message: "name and code are required" });

    const invalid = await as("post", "/states", token).send({
      name: "A",
      code: "V",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body.errors).toBeDefined();
  });

  it("responds 403 for a blocked user", async () => {
    const token = await tokenFor("admin");
    await User.update({ isBlocked: true }, { where: { username: "admin" } });

    const response = await as("get", "/states", token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});

describe("GET /states with a real database", () => {
  it("returns the states ordered by name with public fields", async () => {
    const zulia = await createState({ name: "Zulia", code: "VE-V" });
    const aragua = await createState({ name: "Aragua", code: "VE-D" });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: aragua.id, name: "Aragua", code: "VE-D" },
      { id: zulia.id, name: "Zulia", code: "VE-V" },
    ]);
  });

  it("returns an empty array when there are no states", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each([
    "admin",
    "seller",
    "dispatcher",
    "manager_warehouse",
    "support",
    "customer",
  ])("allows a %s to read the list", async (role) => {
    await createState();
    const token = await tokenFor(role);

    const response = await as("get", "/states", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([PUBLIC_STATE]);
  });
});

describe("GET /states/:id with a real database", () => {
  it("returns one state for the allowed roles", async () => {
    const state = await createState();
    const token = await tokenFor("customer");

    const response = await as("get", `/states/${state.id}`, token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ...PUBLIC_STATE, id: state.id });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("get", "/states/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "State not found" });

    const invalid = await as("get", "/states/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid state id" },
    });
  });
});
