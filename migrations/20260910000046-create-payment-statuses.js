"use strict";

const TABLE = "payment_statuses";
const CODE_UNIQUE = "payment_statuses_code_unique";
const CODE_FORMAT = "payment_statuses_code_format";
const SORT_ORDER_CHECK = "payment_statuses_sort_order_non_negative";
const SORT_ORDER_INDEX = "payment_statuses_sort_order_idx";
const BASE_STATUSES = Object.freeze([
  {
    code: "pending",
    name: "Pendiente",
    description: null,
    sort_order: 10,
    is_system: true,
  },
  {
    code: "conciliated",
    name: "Conciliado",
    description: null,
    sort_order: 20,
    is_system: true,
  },
  {
    code: "rejected",
    name: "Rechazado",
    description: null,
    sort_order: 30,
    is_system: true,
  },
]);

/**
 * Creates the payment reconciliation status catalog and seeds the three base
 * codes. The same rows are inserted by the idempotent seeder; doing it here as
 * well lets the following migrations rely on `conciliated` for the backfill.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      code: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      is_system: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["code"],
      type: "unique",
      name: CODE_UNIQUE,
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["code"],
      type: "check",
      name: CODE_FORMAT,
      where: Sequelize.literal("code ~ '^[a-z][a-z0-9_]{1,19}$'"),
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["sort_order"],
      type: "check",
      name: SORT_ORDER_CHECK,
      where: { sort_order: { [Sequelize.Op.gte]: 0 } },
    });
    await queryInterface.addIndex(TABLE, ["sort_order"], {
      name: SORT_ORDER_INDEX,
    });

    const now = new Date();

    await queryInterface.bulkInsert(
      TABLE,
      BASE_STATUSES.map((status) => ({
        ...status,
        createdAt: now,
        updatedAt: now,
      })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
