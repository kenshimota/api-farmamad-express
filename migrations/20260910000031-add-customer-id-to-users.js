"use strict";

const TABLE = "users";
const INDEX = "users_customer_id_idx";
const FOREIGN_KEY = "users_customer_id_fkey";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE, "customer_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.addConstraint(TABLE, {
      fields: ["customer_id"],
      type: "foreign key",
      name: FOREIGN_KEY,
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["customer_id"], { name: INDEX });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, INDEX);
    await queryInterface.removeConstraint(TABLE, FOREIGN_KEY);
    await queryInterface.removeColumn(TABLE, "customer_id");
  },
};
