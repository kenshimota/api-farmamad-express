"use strict";

const TABLE = "order_statuses";
const CODE_UNIQUE = "order_statuses_code_unique";
const CODE_FORMAT = "order_statuses_code_format";
const SORT_ORDER_CHECK = "order_statuses_sort_order_non_negative";
const NEXT_FOREIGN_KEY = `${TABLE}_next_status_code_fkey`;
const SORT_ORDER_INDEX = `${TABLE}_sort_order_idx`;
const BASE_STATUSES = Object.freeze([
  {
    code: "draft",
    name: "Borrador",
    description: null,
    sort_order: 10,
    next_status_code: "request",
    is_system: true,
  },
  {
    code: "request",
    name: "Solicitado",
    description: null,
    sort_order: 20,
    next_status_code: "generate",
    is_system: true,
  },
  {
    code: "generate",
    name: "Generado",
    description: null,
    sort_order: 30,
    next_status_code: "invoiced",
    is_system: true,
  },
  {
    code: "invoiced",
    name: "Facturado",
    description: null,
    sort_order: 40,
    next_status_code: null,
    is_system: true,
  },
  {
    code: "cancelled",
    name: "Cancelado",
    description: null,
    sort_order: 50,
    next_status_code: null,
    is_system: true,
  },
]);

/** @type {import('sequelize-cli').Migration} */
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
      next_status_code: {
        type: Sequelize.STRING(20),
        allowNull: true,
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["next_status_code"],
      type: "foreign key",
      name: NEXT_FOREIGN_KEY,
      references: { table: TABLE, field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["sort_order"], {
      name: SORT_ORDER_INDEX,
    });

    // The base statuses are inserted here as well as by the idempotent seeder:
    // the FK/mapping migration that follows needs the target rows to exist even
    // when migrations run without the seeder step.
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
