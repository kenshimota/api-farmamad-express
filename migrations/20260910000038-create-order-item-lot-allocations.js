"use strict";

const TABLE = "order_item_lot_allocations";
const UNIQUE_COMBINATION = `${TABLE}_order_item_lot_unique`;
const QUANTITY_CHECK = `${TABLE}_quantity_positive`;
const STATUS_CHECK = `${TABLE}_status_check`;
const STATUSES = Object.freeze(["reserved", "released", "consumed"]);
const FOREIGN_KEYS = Object.freeze([
  ["order_item_id", "order_items", "CASCADE"],
  ["lot_id", "lots", "RESTRICT"],
]);
const INDEXES = Object.freeze(["lot_id", "status"]);

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
      order_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      lot_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      quantity: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "reserved",
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

    for (const [field, table, onDelete] of FOREIGN_KEYS) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "foreign key",
        name: `${TABLE}_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete,
      });
    }

    await queryInterface.addConstraint(TABLE, {
      fields: ["order_item_id", "lot_id"],
      type: "unique",
      name: UNIQUE_COMBINATION,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["quantity"],
      type: "check",
      name: QUANTITY_CHECK,
      where: { quantity: { [Sequelize.Op.gt]: 0 } },
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["status"],
      type: "check",
      name: STATUS_CHECK,
      where: { status: { [Sequelize.Op.in]: [...STATUSES] } },
    });

    for (const column of INDEXES) {
      await queryInterface.addIndex(TABLE, [column], {
        name: `${TABLE}_${column}_idx`,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
