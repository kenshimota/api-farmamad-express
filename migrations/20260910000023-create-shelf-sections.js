"use strict";

const TABLE = "shelf_sections";
const SHELF_FK = "shelf_sections_shelf_id_fkey";
const CODE_INDEX = "shelf_sections_shelf_code_lower_unique";
const SHELF_INDEX = "shelf_sections_shelf_id_idx";

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
      shelf_id: {
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
      fields: ["shelf_id"],
      type: "foreign key",
      name: SHELF_FK,
      references: { table: "shelves", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });

    // The API stores codes in uppercase, but the database also rejects
    // duplicates that only differ in case inside the same shelf.
    await queryInterface.addIndex(
      TABLE,
      ["shelf_id", Sequelize.literal('LOWER("code")')],
      {
        unique: true,
        name: CODE_INDEX,
      },
    );

    await queryInterface.addIndex(TABLE, ["shelf_id"], {
      name: SHELF_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
