"use strict";

const TABLE = "shelves";
const WAREHOUSE_FK = "shelves_warehouse_id_fkey";
const CODE_INDEX = "shelves_warehouse_code_lower_unique";
const WAREHOUSE_INDEX = "shelves_warehouse_id_idx";

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
      warehouse_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      description: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["warehouse_id"],
      type: "foreign key",
      name: WAREHOUSE_FK,
      references: { table: "warehouses", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // The API stores codes in uppercase, but the database also rejects
    // duplicates that only differ in case inside the same warehouse.
    await queryInterface.addIndex(
      TABLE,
      ["warehouse_id", Sequelize.literal('LOWER("code")')],
      {
        unique: true,
        name: CODE_INDEX,
      },
    );

    await queryInterface.addIndex(TABLE, ["warehouse_id"], {
      name: WAREHOUSE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
