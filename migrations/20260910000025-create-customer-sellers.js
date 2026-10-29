"use strict";

const TABLE = "customer_sellers";
const FOREIGN_KEYS = Object.freeze([
  ["customer_id", "customers"],
  ["seller_id", "users"],
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
      customer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      seller_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assigned_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
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

    for (const [field, table] of FOREIGN_KEYS) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "foreign key",
        name: `${TABLE}_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      });
    }

    // One customer can have at most one seller while this rule is in place.
    await queryInterface.addConstraint(TABLE, {
      fields: ["customer_id"],
      type: "unique",
      name: `${TABLE}_customer_id_unique`,
    });

    // A seller can have many customers, so this index speeds up their list.
    await queryInterface.addIndex(TABLE, ["seller_id"], {
      name: `${TABLE}_seller_id_idx`,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
