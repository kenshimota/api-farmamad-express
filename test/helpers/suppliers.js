const request = require("supertest");
const app = require("../../src/app");
const User = require("../../src/models/user");
const Role = require("../../src/models/role");
const Supplier = require("../../src/models/supplier");
const City = require("../../src/models/city");
const State = require("../../src/models/state");

const PASSWORD = "secret123";
const STATE_BODY = { name: "Aragua", code: "VE-D" };
const CITY_BODY = { name: "Maracay" };
const BODY = {
  name: "Distribuidora La Salud C.A.",
  identification: "J-12345678-9",
  email: "ventas@lasalud.com",
  phone: "+58 212 555-1234",
  observations: "Entrega los martes",
  address: "Av. Principal, Galpón 4",
};
const PUBLIC_SUPPLIER = {
  id: expect.any(Number),
  name: BODY.name,
  identification: BODY.identification,
  email: BODY.email,
  phone: BODY.phone,
  observations: BODY.observations,
  address: BODY.address,
  city_id: expect.any(Number),
  state_id: expect.any(Number),
};
const USERS = {
  admin: { username: "admin", email: "admin@superking.com", name: "Admin" },
  seller: { username: "maria", email: "maria@superking.com", name: "María" },
  dispatcher: {
    username: "pedro",
    email: "pedro@superking.com",
    name: "Pedro",
  },
  manager_warehouse: {
    username: "luis",
    email: "luis@superking.com",
    name: "Luis",
  },
  support: {
    username: "sofia",
    email: "sofia@superking.com",
    name: "Sofía",
  },
  customer: { username: "ana", email: "ana@superking.com", name: "Ana" },
};

/**
 * Resolves a role id from the seeded roles table.
 * @param {string} name - Role name.
 * @returns {Promise<number>} The role primary key.
 */
async function getRoleId(name) {
  const role = await Role.findOne({ where: { name } });

  if (!role) {
    throw new Error(`Role "${name}" is not seeded`);
  }

  return role.id;
}

/**
 * Creates a user with the given role and returns a valid JWT for it.
 * @param {string} role - Role name from the seeded catalog.
 * @returns {Promise<string>} The signed token.
 */
async function tokenFor(role) {
  const { username, email, name } = USERS[role];

  await User.create({
    username,
    email,
    name,
    password: PASSWORD,
    roleId: await getRoleId(role),
  });

  const response = await request(app)
    .post("/auth/login")
    .send({ identifier: username, password: PASSWORD });

  return response.body.token;
}

/**
 * Creates a state directly in the database.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
function createState(overrides = {}) {
  return State.create({ ...STATE_BODY, ...overrides });
}

/**
 * Creates a city directly in the database. When `state_id` is omitted it
 * creates the default Aragua state first.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createCity(overrides = {}) {
  const values = { ...CITY_BODY, ...overrides };

  if (values.state_id === undefined) {
    const state = await createState();

    values.state_id = state.id;
  }

  return City.create(values);
}

/**
 * Creates a state with its default city, ready to be referenced by a supplier.
 * @returns {Promise<{ state: object, city: object }>} The location pair.
 */
async function createLocation() {
  const state = await createState();
  const city = await createCity({ state_id: state.id });

  return { state, city };
}

/**
 * Creates a supplier directly in the database. When the location is omitted it
 * creates the required state and a city inside it.
 * @param {object} [overrides] - Attribute overrides.
 * @returns {Promise<object>} The created Sequelize instance.
 */
async function createSupplier(overrides = {}) {
  const values = { ...BODY, ...overrides };

  if (values.city_id === undefined) {
    if (values.state_id === undefined) {
      const state = await createState();

      values.state_id = state.id;
    }

    const city = await createCity({
      name: `Ciudad ${values.identification}`.slice(0, 100),
      state_id: values.state_id,
    });

    values.city_id = city.id;
    values.state_id = city.state_id;
  } else if (values.state_id === undefined) {
    const city = await City.findByPk(values.city_id);

    values.state_id = city.state_id;
  }

  return Supplier.create(values);
}

/**
 * Authenticated request helper.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {import("supertest").Test} The supertest request.
 */
function as(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

/**
 * Truncates the suppliers, cities, states and users tables of the test
 * database. Suppliers go first so the restrictive foreign keys never block the
 * cleanup.
 * @returns {Promise<void>} Resolves once the tables are empty.
 */
async function resetDatabase() {
  await Supplier.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await City.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await State.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
}

module.exports = {
  PASSWORD,
  BODY,
  CITY_BODY,
  STATE_BODY,
  PUBLIC_SUPPLIER,
  as,
  createCity,
  createLocation,
  createState,
  createSupplier,
  resetDatabase,
  tokenFor,
};
