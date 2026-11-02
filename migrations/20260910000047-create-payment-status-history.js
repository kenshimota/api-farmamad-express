"use strict";

const TABLE = "payment_status_history";
const PAYMENT_FOREIGN_KEY = `${TABLE}_payment_id_fkey`;
const FROM_FOREIGN_KEY = `${TABLE}_from_status_fkey`;
const TO_FOREIGN_KEY = `${TABLE}_to_status_fkey`;
const ACTOR_FOREIGN_KEY = `${TABLE}_actor_user_id_fkey`;
const PAYMENT_INDEX = `${TABLE}_payment_created_idx`;

/**
 * Creates the append-only payment status history. Deleting a payment cascades
 * its events; the status and user references are restrictive so the catalog
 * and the actors cannot disappear while they are referenced.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable(TABLE, {
      id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      payment_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      from_status: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      to_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      reason: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      actor_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      metadata: {
        type: Sequelize.JSONB,
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
      fields: ["payment_id"],
      type: "foreign key",
      name: PAYMENT_FOREIGN_KEY,
      references: { table: "payments", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["from_status"],
      type: "foreign key",
      name: FROM_FOREIGN_KEY,
      references: { table: "payment_statuses", field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["to_status"],
      type: "foreign key",
      name: TO_FOREIGN_KEY,
      references: { table: "payment_statuses", field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["actor_user_id"],
      type: "foreign key",
      name: ACTOR_FOREIGN_KEY,
      references: { table: "users", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.addIndex(TABLE, ["payment_id", "createdAt", "id"], {
      name: PAYMENT_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
