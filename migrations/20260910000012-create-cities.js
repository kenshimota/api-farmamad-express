"use strict";

const TABLE = "cities";

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
        type: Sequelize.STRING(100),
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
      fields: ["state_id"],
      type: "foreign key",
      name: "cities_state_id_fkey",
      references: { table: "states", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["name", "state_id"], {
      unique: true,
      name: "cities_name_state_id_unique",
    });

    await queryInterface.addIndex(TABLE, ["state_id"]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
