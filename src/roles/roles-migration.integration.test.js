process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { Sequelize } = require("sequelize");
const sequelize = require("../database");
const User = require("../models/user");
const Role = require("../models/role");
const migration = require("../../migrations/20260910000006-align-roles-catalog");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const PASSWORD = "secret123";
const NEW_ROLES = [
  "admin",
  "customer",
  "seller",
  "dispatcher",
  "manager_warehouse",
  "support",
];
const OLD_ROLES = [
  "admin",
  "seller",
  "delivery",
  "freelance_delivery",
  "customer",
];

/**
 * Runs the migration up against the integration database.
 * @returns {Promise<void>}
 */
async function runUp() {
  await migration.up(sequelize.getQueryInterface(), Sequelize);
}

/**
 * Runs the migration down against the integration database.
 * @returns {Promise<void>}
 */
async function runDown() {
  await migration.down(sequelize.getQueryInterface(), Sequelize);
}

/**
 * Returns the role names stored in the database ordered by id.
 * @returns {Promise<string[]>} Role names.
 */
async function catalog() {
  const roles = await Role.findAll({ order: [["id", "ASC"]] });

  return roles.map((role) => role.name);
}

/**
 * Resolves a role id by name.
 * @param {string} name - Role name.
 * @returns {Promise<number>} Role primary key.
 */
async function roleId(name) {
  const role = await Role.findOne({ where: { name } });

  if (!role) {
    throw new Error(`Role "${name}" is not available`);
  }

  return role.id;
}

/**
 * Creates a user with the given role.
 * @param {string} username - Unique username.
 * @param {string} role - Role name present in the current catalog.
 * @returns {Promise<object>} The created user.
 */
async function createUser(username, role) {
  return User.create({
    username,
    email: `${username}@example.com`,
    name: username,
    password: PASSWORD,
    roleId: await roleId(role),
  });
}

/**
 * Reads the role name of a user.
 * @param {number} id - User id.
 * @returns {Promise<string|null>} Role name or null when the relation is broken.
 */
async function userRoleName(id) {
  const user = await User.findByPk(id, {
    include: { model: Role, as: "role" },
  });

  return user.role ? user.role.name : null;
}

/**
 * Asserts that no user has a dangling role reference.
 * @returns {Promise<void>}
 */
async function expectValidRoleReferences() {
  const users = await User.findAll({
    include: { model: Role, as: "role" },
  });

  for (const user of users) {
    expect(user.role).not.toBeNull();
  }
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await runUp();
});

afterEach(async () => {
  await runUp();
});

afterAll(async () => {
  await User.destroy({
    where: {},
    truncate: { cascade: true, restartIdentity: true },
  });
  await runUp();
  await sequelize.close();
});

describe("roles catalog migration with a real database", () => {
  it("migrates delivery and freelance_delivery users to dispatcher", async () => {
    await runDown();

    const deliveryUser = await createUser("delivery-user", "delivery");
    const freelanceUser = await createUser(
      "freelance-user",
      "freelance_delivery",
    );
    const customerUser = await createUser("customer-user", "customer");

    await runUp();

    expect((await catalog()).sort()).toEqual([...NEW_ROLES].sort());
    await expect(userRoleName(deliveryUser.id)).resolves.toBe("dispatcher");
    await expect(userRoleName(freelanceUser.id)).resolves.toBe("dispatcher");
    await expect(userRoleName(customerUser.id)).resolves.toBe("customer");
    await expect(Role.findOne({ where: { name: "delivery" } })).resolves.toBe(
      null,
    );
    await expect(
      Role.findOne({ where: { name: "freelance_delivery" } }),
    ).resolves.toBe(null);
    await expectValidRoleReferences();
  });

  it("keeps exactly six unique roles when applied repeatedly", async () => {
    const dispatcherUser = await createUser("dispatcher-user", "dispatcher");

    await runUp();
    await runUp();

    const roles = await Role.findAll();
    expect(roles).toHaveLength(6);
    expect(new Set(roles.map((role) => role.name)).size).toBe(6);
    await expect(userRoleName(dispatcherUser.id)).resolves.toBe("dispatcher");
  });

  it("restores the old catalog and keeps every user with a valid role on rollback", async () => {
    const dispatcherUser = await createUser("dispatcher-user", "dispatcher");
    const warehouseUser = await createUser(
      "warehouse-user",
      "manager_warehouse",
    );
    const supportUser = await createUser("support-user", "support");
    const adminUser = await createUser("admin-user", "admin");

    await runDown();

    expect((await catalog()).sort()).toEqual([...OLD_ROLES].sort());
    await expect(userRoleName(dispatcherUser.id)).resolves.toBe("delivery");
    await expect(userRoleName(warehouseUser.id)).resolves.toBe("delivery");
    await expect(userRoleName(supportUser.id)).resolves.toBe("delivery");
    await expect(userRoleName(adminUser.id)).resolves.toBe("admin");
    await expectValidRoleReferences();

    await runDown();

    expect((await catalog()).sort()).toEqual([...OLD_ROLES].sort());
    await expectValidRoleReferences();
  });
});
