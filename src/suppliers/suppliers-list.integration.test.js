process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
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

describe("GET /suppliers with a real database", () => {
  it("returns the suppliers ordered by name with their location nested", async () => {
    const { state, city } = await createLocation();
    await createSupplier({
      name: "Zeta Distribuciones",
      identification: "J-22222222-2",
      city_id: city.id,
      state_id: state.id,
    });
    const alfa = await createSupplier({
      name: "Alfa Suministros",
      identification: "J-11111111-1",
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor("dispatcher");

    const response = await as("get", "/suppliers", token);

    expect(response.status).toBe(200);
    expect(response.body.map((supplier) => supplier.name)).toEqual([
      "Alfa Suministros",
      "Zeta Distribuciones",
    ]);
    expect(response.body[0].city).toEqual({ id: city.id, name: "Maracay" });
    expect(response.body[0].state).toEqual({
      id: state.id,
      name: "Aragua",
      code: "VE-D",
    });
    expect(response.body[0].id).toBe(alfa.id);
    expect(response.body[0]).not.toHaveProperty("createdAt");
    expect(response.body[0]).not.toHaveProperty("updatedAt");
  });

  it("filters by state_id and city_id", async () => {
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
    const inAragua = await createSupplier({
      identification: "J-11111111-1",
      city_id: maracay.id,
      state_id: aragua.id,
    });
    await createSupplier({
      identification: "J-22222222-2",
      city_id: valencia.id,
      state_id: carabobo.id,
    });
    const token = await tokenFor("admin");

    const byState = await as("get", `/suppliers?state_id=${aragua.id}`, token);
    expect(byState.status).toBe(200);
    expect(byState.body.map((supplier) => supplier.id)).toEqual([inAragua.id]);

    const byCity = await as("get", `/suppliers?city_id=${valencia.id}`, token);
    expect(byCity.status).toBe(200);
    expect(byCity.body).toHaveLength(1);
    expect(byCity.body[0].city_id).toBe(valencia.id);
  });

  it("searches by name or identification ignoring case", async () => {
    const { state, city } = await createLocation();
    const byName = await createSupplier({
      name: "Distribuidora La Salud C.A.",
      identification: "J-11111111-1",
      city_id: city.id,
      state_id: state.id,
    });
    const byId = await createSupplier({
      name: "Comercial El Sol",
      identification: "J-SALUD-9",
      city_id: city.id,
      state_id: state.id,
    });
    await createSupplier({
      name: "Otra Empresa",
      identification: "J-33333333-3",
      city_id: city.id,
      state_id: state.id,
    });
    const token = await tokenFor("admin");

    const response = await as("get", "/suppliers?q=salud", token);

    expect(response.status).toBe(200);
    expect(response.body.map((supplier) => supplier.id).sort()).toEqual(
      [byName.id, byId.id].sort(),
    );
  });

  it("responds 422 for invalid filters", async () => {
    const token = await tokenFor("admin");

    const state = await as("get", "/suppliers?state_id=abc", token);
    expect(state.status).toBe(422);
    expect(state.body).toEqual({ errors: { state_id: "Invalid state" } });

    const city = await as("get", "/suppliers?city_id=0", token);
    expect(city.status).toBe(422);
    expect(city.body).toEqual({ errors: { city_id: "Invalid city id" } });
  });

  it("returns an empty array when there are no suppliers", async () => {
    const token = await tokenFor("admin");

    const response = await as("get", "/suppliers", token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
