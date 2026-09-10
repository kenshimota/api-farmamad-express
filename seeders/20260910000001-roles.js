"use strict";

const ROLES = ["admin", "seller", "delivery", "freelance_delivery", "customer"];

/** @type {import('sequelize-cli').Seeder} */
module.exports = {
  async up(queryInterface) {
    const now = new Date();

    await queryInterface.bulkInsert(
      "roles",
      ROLES.map((name) => ({ name, createdAt: now, updatedAt: now })),
      { ignoreDuplicates: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("roles", { name: ROLES }, {});
  },
};
