"use strict";

const TABLE = "purchase_items";
const LOTS = "lots";
const OLD_UNIQUE = "purchase_items_purchase_product_state_unique";
const RECEIVED_FK = "purchase_items_received_lot_id_fkey";
const RECEIVED_INDEX = "purchase_items_received_lot_id_idx";
const LOT_UNIQUE_INDEX = "purchase_items_purchase_product_lot_unique";
const PAIR_CHECK = "purchase_items_lot_pair_complete";
const RECEIVED_LOT_CHECK = "purchase_items_received_lot_requires_lot_number";

/**
 * Adds the lot data required to receive a purchase line. Historical lines stay
 * nullable; new lines enforce the lot via the API validators and the database
 * checks. The old product/state unique constraint is replaced by a partial
 * unique index on the case-insensitive lot number per purchase and product.
 * @type {import('sequelize-cli').Migration}
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(TABLE, "lot_number", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "expiration_date", {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn(TABLE, "received_lot_id", {
      type: Sequelize.INTEGER,
      allowNull: true,
    });

    await queryInterface.removeConstraint(TABLE, OLD_UNIQUE);

    await queryInterface.addConstraint(TABLE, {
      fields: ["received_lot_id"],
      type: "foreign key",
      name: RECEIVED_FK,
      references: { table: LOTS, field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${PAIR_CHECK}"
       CHECK (
         ("lot_number" IS NULL AND "expiration_date" IS NULL)
         OR ("lot_number" IS NOT NULL AND "expiration_date" IS NOT NULL)
       )`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${RECEIVED_LOT_CHECK}"
       CHECK ("received_lot_id" IS NULL OR "lot_number" IS NOT NULL)`,
    );

    await queryInterface.addIndex(TABLE, ["received_lot_id"], {
      name: RECEIVED_INDEX,
    });
    await queryInterface.sequelize.query(
      `CREATE UNIQUE INDEX "${LOT_UNIQUE_INDEX}"
       ON "${TABLE}" ("purchase_id", "product_id", LOWER("lot_number"))
       WHERE "lot_number" IS NOT NULL`,
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS "${LOT_UNIQUE_INDEX}"`,
    );
    await queryInterface.removeIndex(TABLE, RECEIVED_INDEX);
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${RECEIVED_LOT_CHECK}"`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${PAIR_CHECK}"`,
    );
    await queryInterface.removeConstraint(TABLE, RECEIVED_FK);
    await queryInterface.removeColumn(TABLE, "received_lot_id");
    await queryInterface.removeColumn(TABLE, "expiration_date");
    await queryInterface.removeColumn(TABLE, "lot_number");
    await queryInterface.addConstraint(TABLE, {
      fields: ["purchase_id", "product_id", "item_state_id"],
      type: "unique",
      name: OLD_UNIQUE,
    });
  },
};
