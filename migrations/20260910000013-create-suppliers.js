"use strict";

const TABLE = "suppliers";
const IDENTIFICATION_INDEX = "suppliers_identification_lower_unique";

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
      name: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      identification: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(150),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },
      observations: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      city_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      state_id: {
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

    await queryInterface.addConstraint(TABLE, {
      fields: ["city_id"],
      type: "foreign key",
      name: "suppliers_city_id_fkey",
      references: { table: "cities", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["state_id"],
      type: "foreign key",
      name: "suppliers_state_id_fkey",
      references: { table: "states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // A functional unique index makes the identification unique ignoring
    // case, which a plain UNIQUE constraint on the column would not do.
    await queryInterface.addIndex(
      TABLE,
      [Sequelize.literal('LOWER("identification")')],
      { unique: true, name: IDENTIFICATION_INDEX },
    );

    await queryInterface.addIndex(TABLE, ["city_id"]);
    await queryInterface.addIndex(TABLE, ["state_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
