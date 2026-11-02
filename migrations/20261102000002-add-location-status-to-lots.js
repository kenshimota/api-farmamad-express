"use strict";

const TABLE = "lots";
const USERS = "users";
const LOCATION_FIELDS = Object.freeze([
  "warehouse_id",
  "shelf_id",
  "section_id",
]);
const AUDIT_FK = Object.freeze([
  ["location_started_by", "lots_location_started_by_fkey"],
  ["located_by", "lots_located_by_fkey"],
]);
const STATUS_CHECK = "lots_location_status_valid";
const LOCATION_CHECK = "lots_location_block_consistent";
const STATUSES = ["pending", "in_progress", "located"];

/**
 * Turns the lot location into an optional block with an explicit lifecycle:
 * `pending` (received but not located), `in_progress` (being located) and
 * `located` (sellable). Existing lots keep their location and become located.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    for (const field of LOCATION_FIELDS) {
      await queryInterface.changeColumn(TABLE, field, {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
    }

    await queryInterface.addColumn(TABLE, "location_status", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "located",
    });
    await queryInterface.addColumn(TABLE, "location_started_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "location_started_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "located_at", {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "located_by", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.sequelize.query(
      `UPDATE "${TABLE}" SET "location_status" = 'located',
       "located_at" = COALESCE("located_at", "updatedAt", NOW())
       WHERE "location_status" = 'located'`,
    );

    for (const [field, name] of AUDIT_FK) {
      await queryInterface.addConstraint(TABLE, {
        fields: [field],
        type: "foreign key",
        name,
        references: { table: USERS, field: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      });
    }

    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${STATUS_CHECK}"
       CHECK ("location_status" IN (${STATUSES.map((status) => `'${status}'`).join(", ")}))`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${LOCATION_CHECK}"
       CHECK (
         (
           "location_status" = 'pending'
           AND "warehouse_id" IS NULL AND "shelf_id" IS NULL
           AND "section_id" IS NULL AND "located_at" IS NULL
         )
         OR (
           "location_status" = 'in_progress'
           AND "warehouse_id" IS NULL AND "shelf_id" IS NULL
           AND "section_id" IS NULL AND "location_started_at" IS NOT NULL
           AND "located_at" IS NULL
         )
         OR (
           "location_status" = 'located'
           AND "warehouse_id" IS NOT NULL AND "shelf_id" IS NOT NULL
           AND "section_id" IS NOT NULL AND "located_at" IS NOT NULL
         )
       )`,
    );

    await queryInterface.addIndex(TABLE, ["location_status"], {
      name: "lots_location_status_idx",
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex(TABLE, "lots_location_status_idx");
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${LOCATION_CHECK}"`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${STATUS_CHECK}"`,
    );

    for (const [, name] of AUDIT_FK) {
      await queryInterface.removeConstraint(TABLE, name);
    }

    await queryInterface.removeColumn(TABLE, "located_by");
    await queryInterface.removeColumn(TABLE, "located_at");
    await queryInterface.removeColumn(TABLE, "location_started_by");
    await queryInterface.removeColumn(TABLE, "location_started_at");
    await queryInterface.removeColumn(TABLE, "location_status");

    for (const field of LOCATION_FIELDS) {
      await queryInterface.changeColumn(TABLE, field, {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
    }
  },
};
