"use strict";

const TABLE = "payments";
const STATUS_TABLE = "payment_statuses";
const STATUS_FOREIGN_KEY = "payments_status_fkey";
const IMAGE_FOREIGN_KEY = "payments_reference_image_id_fkey";
const REJECTED_REASON_CHECK = "payments_rejected_reason_required";
const REASON_ONLY_REJECTED_CHECK = "payments_reason_only_when_rejected";
const STATUS_INDEX = "payments_status_idx";
const IMAGE_INDEX = "payments_reference_image_id_idx";
const BASE_STATUSES = Object.freeze([
  {
    code: "pending",
    name: "Pendiente",
    description: null,
    sort_order: 10,
    is_system: true,
  },
  {
    code: "conciliated",
    name: "Conciliado",
    description: null,
    sort_order: 20,
    is_system: true,
  },
  {
    code: "rejected",
    name: "Rechazado",
    description: null,
    sort_order: 30,
    is_system: true,
  },
]);

/**
 * Adds the reconciliation status, rejection reason and reference image to the
 * payments table. Existing payments are backfilled to `conciliated` because
 * they already have their deposit movement; a matching initial history event
 * is appended so the audit trail explains the migrated state.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE, "status", {
      type: Sequelize.STRING(20),
      allowNull: false,
      defaultValue: "pending",
    });
    await queryInterface.addColumn(TABLE, "rejection_reason", {
      type: Sequelize.STRING(500),
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "reference_image_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    const now = new Date();

    await queryInterface.bulkInsert(
      STATUS_TABLE,
      BASE_STATUSES.map((status) => ({
        ...status,
        createdAt: now,
        updatedAt: now,
      })),
      { ignoreDuplicates: true },
    );

    await queryInterface.sequelize.query(
      `UPDATE "${TABLE}" SET "status" = 'conciliated'`,
    );
    await queryInterface.sequelize.query(
      `INSERT INTO "payment_status_history" ("payment_id", "from_status", "to_status", "reason", "actor_user_id", "metadata", "createdAt", "updatedAt") SELECT "id", NULL, 'conciliated', NULL, "created_by_user_id", NULL, "createdAt", "updatedAt" FROM "${TABLE}"`,
    );

    await queryInterface.addConstraint(TABLE, {
      fields: ["status"],
      type: "foreign key",
      name: STATUS_FOREIGN_KEY,
      references: { table: STATUS_TABLE, field: "code" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["reference_image_id"],
      type: "foreign key",
      name: IMAGE_FOREIGN_KEY,
      references: { table: "images", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["status", "rejection_reason"],
      type: "check",
      name: REJECTED_REASON_CHECK,
      where: Sequelize.literal(
        "status <> 'rejected' OR rejection_reason IS NOT NULL",
      ),
    });
    await queryInterface.addConstraint(TABLE, {
      fields: ["status", "rejection_reason"],
      type: "check",
      name: REASON_ONLY_REJECTED_CHECK,
      where: Sequelize.literal(
        "status = 'rejected' OR rejection_reason IS NULL",
      ),
    });
    await queryInterface.addIndex(TABLE, ["status"], {
      name: STATUS_INDEX,
    });
    await queryInterface.addIndex(TABLE, ["reference_image_id"], {
      name: IMAGE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex(TABLE, IMAGE_INDEX);
    await queryInterface.removeIndex(TABLE, STATUS_INDEX);
    await queryInterface.removeConstraint(TABLE, REASON_ONLY_REJECTED_CHECK);
    await queryInterface.removeConstraint(TABLE, REJECTED_REASON_CHECK);
    await queryInterface.removeConstraint(TABLE, IMAGE_FOREIGN_KEY);
    await queryInterface.removeConstraint(TABLE, STATUS_FOREIGN_KEY);
    await queryInterface.removeColumn(TABLE, "reference_image_id");
    await queryInterface.removeColumn(TABLE, "rejection_reason");
    await queryInterface.removeColumn(TABLE, "status");
  },
};
