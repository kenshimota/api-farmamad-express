"use strict";

const DEFAULT_ROLE = "customer";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("roles", {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
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

    const now = new Date();

    // Make the default role available before seeders run so existing users
    // can be backfilled safely. The seeder is idempotent and skips it.
    await queryInterface.bulkInsert(
      "roles",
      [{ name: DEFAULT_ROLE, createdAt: now, updatedAt: now }],
      { ignoreDuplicates: true },
    );

    // Add the column as nullable first to keep the migration safe when the
    // users table already has rows.
    await queryInterface.addColumn("users", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    const roleId = await queryInterface.rawSelect(
      "roles",
      { where: { name: DEFAULT_ROLE } },
      ["id"],
    );

    await queryInterface.bulkUpdate("users", { roleId }, { roleId: null });

    await queryInterface.changeColumn("users", "roleId", {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.addConstraint("users", {
      fields: ["roleId"],
      type: "foreign key",
      name: "users_roleId_fkey",
      references: { table: "roles", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint("users", "users_roleId_fkey");
    await queryInterface.removeColumn("users", "roleId");
    await queryInterface.dropTable("roles");
  },
};
