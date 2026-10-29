"use strict";

const TABLE = "lots";
const NUMBER_INDEX = "lots_product_id_number_lower_unique";
const NON_NEGATIVE_CHECKS = Object.freeze([
  ["stock", "lots_stock_non_negative"],
  ["reserved", "lots_reserved_non_negative"],
]);
const FOREIGN_KEYS = Object.freeze([
  ["product_id", "products"],
  ["item_state_id", "item_states"],
  ["warehouse_id", "warehouses"],
  ["shelf_id", "shelves"],
  ["section_id", "shelf_sections"],
]);
const LOOKUP_COLUMNS = Object.freeze([
  "product_id",
  "item_state_id",
  "warehouse_id",
  "shelf_id",
  "section_id",
  "expiration_date",
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
      number: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      expiration_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },
      item_state_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      stock: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      reserved: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      warehouse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      shelf_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      section_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
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
        name: `lots_${field}_fkey`,
        references: { table, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    for (const [field, name] of NON_NEGATIVE_CHECKS) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "check",
        name,
        where: { [field]: { [Sequelize.Op.gte]: 0 } },
      });
    }

    await queryInterface.addConstraint(TABLE, {
      fields: ["reserved", "stock"],
      type: "check",
      name: "lots_reserved_within_stock",
      where: { reserved: { [Sequelize.Op.lte]: Sequelize.col("stock") } },
    });

    // A lot number is unique per product ignoring case, so the API and the
    // database reject `L-1` and `l-1` for the same product.
    await queryInterface.addIndex(
      TABLE,
      ["product_id", Sequelize.literal('LOWER("number")')],
      {
        unique: true,
        name: NUMBER_INDEX,
      },
    );

    for (const column of LOOKUP_COLUMNS) {
      await queryInterface.addIndex(TABLE, [column], {
        name: `lots_${column}_idx`,
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
