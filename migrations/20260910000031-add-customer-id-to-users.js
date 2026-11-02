"use strict";

const TABLE = "users";

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
      name: "users_customer_id_fkey",
      references: { table: "customers", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // Postgres allows multiple NULLs in a unique index, so internal users keep
    // working while a customer can be linked to one account at most.
    await queryInterface.addIndex(TABLE, ["customer_id"], {
      unique: true,
      name: "users_customer_id_unique",
    });
    await queryInterface.addIndex(TABLE, ["customer_id"], {
      name: "users_customer_id_idx",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, "users_customer_id_idx");
    await queryInterface.removeIndex(TABLE, "users_customer_id_unique");
    await queryInterface.removeConstraint(TABLE, "users_customer_id_fkey");
    await queryInterface.removeColumn(TABLE, "customer_id");
  },
};
