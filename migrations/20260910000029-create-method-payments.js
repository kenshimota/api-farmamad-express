"use strict";

const TABLE = "method_payments";
const TYPE_INDEX = "method_payments_method_payment_type_id_idx";
const LABEL_INDEX = "method_payments_type_label_unique";

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
      method_payment_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      label: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      fields: ["method_payment_type_id"],
      type: "foreign key",
      name: `${TABLE}_method_payment_type_id_fkey`,
      references: { table: "method_payment_types", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });

    // The API stores labels as typed, but the database rejects duplicates
    // inside the same type ignoring case.
    await queryInterface.addIndex(
      TABLE,
      ["method_payment_type_id", Sequelize.literal('LOWER("label")')],
      {
        unique: true,
        name: LABEL_INDEX,
      },
    );

    await queryInterface.addIndex(TABLE, ["method_payment_type_id"], {
      name: TYPE_INDEX,
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable(TABLE);
  },
};
