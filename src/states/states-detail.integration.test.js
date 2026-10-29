process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const request = require("supertest");
const app = require("../app");
const sequelize = require("../database");
const State = require("../models/state");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  BODY,
  as,
  createState,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/states");
const { createCity } = require("../../test/helpers/cities");

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

describe("PUT /states/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to update the state and answers 202",
    async (role) => {
      const state = await createState();
      const token = await tokenFor(role);

      const response = await as("put", `/states/${state.id}`, token).send({
        name: "Aragua",
        code: "VE-E",
      });

      expect(response.status).toBe(202);
      expect(response.body).toEqual({
        id: state.id,
        name: "Aragua",
        code: "VE-E",
      });

      const stored = await State.findByPk(state.id);
      expect(stored.code).toBe("VE-E");
    },
  );

  it("updates only the provided fields", async () => {
    const state = await createState();
    const token = await tokenFor("admin");

    const renamed = await as("put", `/states/${state.id}`, token).send({
      name: "  Aragua  ",
    });
    expect(renamed.status).toBe(202);
    expect(renamed.body).toEqual({
      id: state.id,
      name: "Aragua",
      code: "VE-D",
    });

    const recoded = await as("put", `/states/${state.id}`, token).send({
      code: "ve-e",
    });
    expect(recoded.status).toBe(202);
    expect(recoded.body.code).toBe("VE-E");
  });

  it("responds 409 when the name or code belongs to another state", async () => {
    await createState({ name: "Aragua", code: "VE-D" });
    const other = await createState({ name: "Carabobo", code: "VE-G" });
    const token = await tokenFor("seller");

    const duplicateName = await as("put", `/states/${other.id}`, token).send({
      name: "ARAGUA",
    });
    expect(duplicateName.status).toBe(409);
    expect(duplicateName.body).toEqual({
      message: "State already exists",
    });

    const duplicateCode = await as("put", `/states/${other.id}`, token).send({
      code: "VE-D",
    });
    expect(duplicateCode.status).toBe(409);
    expect(duplicateCode.body).toEqual({
      message: "State already exists",
    });
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("put", "/states/99999", token).send(BODY);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "State not found" });

    const invalid = await as("put", "/states/0", token).send(BODY);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid state id" },
    });
  });

  it("responds 400 and 422 for empty and invalid bodies", async () => {
    const state = await createState();
    const token = await tokenFor("admin");

    const empty = await as("put", `/states/${state.id}`, token).send({});
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ message: "name or code is required" });

    const invalid = await as("put", `/states/${state.id}`, token).send({
      name: "A",
    });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { name: "Nombre inválido" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const state = await createState();
    const token = await tokenFor("dispatcher");

    const response = await as("put", `/states/${state.id}`, token).send(BODY);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });
});

describe("DELETE /states/:id with a real database", () => {
  it.each(["admin", "seller"])(
    "allows a %s to delete a state without cities and answers 204",
    async (role) => {
      const state = await createState();
      const token = await tokenFor(role);

      const response = await as("delete", `/states/${state.id}`, token);

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      await expect(State.findByPk(state.id)).resolves.toBeNull();
    },
  );

  it("responds 409 and keeps the state when it has cities", async () => {
    const state = await createState();
    await createCity({ state_id: state.id });
    const token = await tokenFor("admin");

    const response = await as("delete", `/states/${state.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "State has cities" });
    await expect(State.findByPk(state.id)).resolves.not.toBeNull();
  });

  it("responds 404 and 422 for unknown and invalid ids", async () => {
    const token = await tokenFor("admin");

    const missing = await as("delete", "/states/99999", token);
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "State not found" });

    const invalid = await as("delete", "/states/abc", token);
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid state id" },
    });
  });

  it("responds 403 for a dispatcher user", async () => {
    const state = await createState();
    const token = await tokenFor("dispatcher");

    const response = await as("delete", `/states/${state.id}`, token);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 401 without a token", async () => {
    const state = await createState();
    const response = await request(app).delete(`/states/${state.id}`);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
