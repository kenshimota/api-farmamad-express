"use strict";

const TABLE = "order_history";
const EVENT_TYPE_CHECK = `${TABLE}_event_type_check`;
const EVENTS = Object.freeze([
  "created",
  "item_added",
  "item_updated",
  "item_removed",
  "status_changed",
  "invoice_issued",
]);
const HISTORY_INDEX = `${TABLE}_order_created_id_idx`;
const FOREIGN_KEYS = Object.freeze([
  ["order_id", "orders", "CASCADE"],
  ["actor_user_id", "users", "RESTRICT"],
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
      order_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      event_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
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
      fields: ["event_type"],
      type: "check",
      name: EVENT_TYPE_CHECK,
      where: { event_type: { [Sequelize.Op.in]: [...EVENTS] } },
    });

    await queryInterface.addIndex(TABLE, ["order_id", "createdAt", "id"], {
      name: HISTORY_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
