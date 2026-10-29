const migration = require("../../migrations/20260910000006-align-roles-catalog");

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
 * Builds a fake query interface backed by an in-memory roles table.
 * @param {Array<{ id: number, name: string }>} initialRoles - Starting roles.
 * @returns {{ queryInterface: object, roles: Array<object> }} Fake state.
 */
function createQueryInterface(initialRoles = []) {
  const roles = initialRoles.map((role) => ({ ...role }));
  let nextId = roles.reduce((max, role) => Math.max(max, role.id), 0) + 1;

  const queryInterface = {
    rawSelect: jest.fn(async (table, { where }) => {
      expect(table).toBe("roles");
      const role = roles.find((candidate) => candidate.name === where.name);

      return role ? role.id : null;
    }),
    bulkInsert: jest.fn(async (table, rows) => {
      expect(table).toBe("roles");

      for (const row of rows) {
        if (!roles.some((role) => role.name === row.name)) {
          roles.push({ id: nextId, name: row.name });
          nextId += 1;
        }
      }
    }),
    bulkUpdate: jest.fn(async (table, values) => {
      expect(table).toBe("users");
      expect(values).toHaveProperty("roleId");
    }),
    bulkDelete: jest.fn(async (table, where) => {
      expect(table).toBe("roles");

      const names = Array.isArray(where.name) ? where.name : [where.name];

      for (const name of names) {
        const index = roles.findIndex((role) => role.name === name);

        if (index >= 0) {
          roles.splice(index, 1);
        }
      }
    }),
  };

  return { queryInterface, roles };
}

const Sequelize = {};

describe("migration 20260910000006-align-roles-catalog", () => {
  describe("up", () => {
    it("creates missing roles, moves legacy users to dispatcher and removes obsolete roles", async () => {
      const { queryInterface, roles } = createQueryInterface([
        { id: 10, name: "admin" },
        { id: 20, name: "seller" },
        { id: 30, name: "delivery" },
        { id: 40, name: "freelance_delivery" },
        { id: 50, name: "customer" },
      ]);

      await migration.up(queryInterface, Sequelize);

      expect(roles.map((role) => role.name).sort()).toEqual(
        [...NEW_ROLES].sort(),
      );
      expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

      const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

      expect(table).toBe("roles");
      expect(rows.map((row) => row.name)).toEqual([
        "dispatcher",
        "manager_warehouse",
        "support",
      ]);
      expect(options).toEqual({ ignoreDuplicates: true });

      expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
        "users",
        { roleId: 51 },
        { roleId: [30, 40] },
      );
      expect(queryInterface.bulkDelete).toHaveBeenCalledWith(
        "roles",
        { name: ["delivery", "freelance_delivery"] },
        {},
      );
    });

    it("creates the roles missing from a partial catalog", async () => {
      const { queryInterface, roles } = createQueryInterface([
        { id: 1, name: "customer" },
      ]);

      await migration.up(queryInterface, Sequelize);

      expect(roles.map((role) => role.name).sort()).toEqual(
        [...NEW_ROLES].sort(),
      );
      expect(
        queryInterface.bulkInsert.mock.calls[0][1].map((row) => row.name),
      ).toEqual([
        "admin",
        "seller",
        "dispatcher",
        "manager_warehouse",
        "support",
      ]);
      expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
      expect(queryInterface.bulkDelete).not.toHaveBeenCalled();
    });

    it("is idempotent when the new catalog is already in place", async () => {
      const { queryInterface, roles } = createQueryInterface(
        NEW_ROLES.map((name, index) => ({ id: index + 1, name })),
      );

      await migration.up(queryInterface, Sequelize);

      expect(roles.map((role) => role.name).sort()).toEqual(
        [...NEW_ROLES].sort(),
      );
      expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
      expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
      expect(queryInterface.bulkDelete).not.toHaveBeenCalled();
    });

    it("fails when the dispatcher role cannot be created", async () => {
      const { queryInterface } = createQueryInterface([]);
      queryInterface.bulkInsert.mockImplementation(async () => {});

      await expect(migration.up(queryInterface, Sequelize)).rejects.toThrow(
        'Role "dispatcher" is required for the migration',
      );
    });

    it("resolves role ids by name from the id column", async () => {
      const { queryInterface } = createQueryInterface([
        { id: 1, name: "admin" },
      ]);

      await migration.up(queryInterface, Sequelize);

      expect(queryInterface.rawSelect).toHaveBeenCalledWith(
        "roles",
        { where: { name: "dispatcher" } },
        ["id"],
      );
    });
  });

  describe("down", () => {
    it("restores the old catalog and moves new-only users to delivery", async () => {
      const { queryInterface, roles } = createQueryInterface([
        { id: 1, name: "customer" },
        { id: 2, name: "admin" },
        { id: 3, name: "seller" },
        { id: 4, name: "dispatcher" },
        { id: 5, name: "manager_warehouse" },
        { id: 6, name: "support" },
      ]);

      await migration.down(queryInterface, Sequelize);

      expect(roles.map((role) => role.name).sort()).toEqual(
        [...OLD_ROLES].sort(),
      );
      expect(queryInterface.bulkInsert).toHaveBeenCalledTimes(1);

      const [table, rows, options] = queryInterface.bulkInsert.mock.calls[0];

      expect(table).toBe("roles");
      expect(rows.map((row) => row.name)).toEqual([
        "delivery",
        "freelance_delivery",
      ]);
      expect(options).toEqual({ ignoreDuplicates: true });

      expect(queryInterface.bulkUpdate).toHaveBeenCalledWith(
        "users",
        { roleId: 7 },
        { roleId: [4, 5, 6] },
      );
      expect(queryInterface.bulkDelete).toHaveBeenCalledWith(
        "roles",
        { name: ["dispatcher", "manager_warehouse", "support"] },
        {},
      );
    });

    it("is idempotent when the old catalog is already in place", async () => {
      const { queryInterface, roles } = createQueryInterface(
        OLD_ROLES.map((name, index) => ({ id: index + 1, name })),
      );

      await migration.down(queryInterface, Sequelize);

      expect(roles.map((role) => role.name).sort()).toEqual(
        [...OLD_ROLES].sort(),
      );
      expect(queryInterface.bulkInsert).not.toHaveBeenCalled();
      expect(queryInterface.bulkUpdate).not.toHaveBeenCalled();
      expect(queryInterface.bulkDelete).not.toHaveBeenCalled();
    });

    it("fails when the delivery role cannot be created", async () => {
      const { queryInterface } = createQueryInterface([]);
      queryInterface.bulkInsert.mockImplementation(async () => {});

      await expect(migration.down(queryInterface, Sequelize)).rejects.toThrow(
        'Role "delivery" is required for the rollback',
      );
    });
  });
});
