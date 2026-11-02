const migration = require("../../migrations/20260910000046-add-tax-id-to-products");

const TAX_ROW = Object.freeze({
  code: "SIN_IVA",
  name: "Sin IVA",
  rate: "0.00",
  description: "Producto exento o no gravado",
  is_active: true,
});

/**
 * Builds the Sequelize type double used by the migration.
 * @returns {object} Sequelize double.
 */
function sequelizeDouble() {
  return {
    INTEGER: "INTEGER",
    Op: { iLike: Symbol("iLike") },
  };
}

/**
 * Builds a query interface double that resolves the SIN_IVA tax.
 * @param {object} [options] - Initial state options.
 * @param {number|null} [options.taxId] - Existing SIN_IVA id.
 * @param {number} [options.createdTaxId] - Id assigned after inserting.
 * @returns {object} Query interface double.
 */
function queryInterfaceDouble({ taxId = 7, createdTaxId = 9 } = {}) {
  const state = { taxId, inserted: null, deleted: null };

  const queryInterface = {
    addColumn: jest.fn(),
    changeColumn: jest.fn(),
    bulkInsert: jest.fn(async (table, rows) => {
      state.inserted = rows[0];
      state.taxId = createdTaxId;
    }),
    bulkUpdate: jest.fn(),
    rawSelect: jest.fn(async (table) =>
      table === "taxes" ? state.taxId : null,
    ),
    addConstraint: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    removeConstraint: jest.fn(),
    removeColumn: jest.fn(),
    sequelize: {
      transaction: jest.fn((work) => work("transaction")),
    },
    state,
  };

  return queryInterface;
}

describe("migration 20260910000046-add-tax-id-to-products", () => {
  it("adds the nullable column, backfills SIN_IVA and makes it required", async () => {
    const query = queryInterfaceDouble({ taxId: 7 });
    const Sequelize = sequelizeDouble();

    await migration.up(query, Sequelize);

    expect(query.addColumn).toHaveBeenCalledWith(
      "products",
      "tax_id",
      { type: "INTEGER", allowNull: true },
      { transaction: "transaction" },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "products",
      { tax_id: 7 },
      { tax_id: null },
      { transaction: "transaction" },
    );
    expect(query.changeColumn).toHaveBeenCalledWith(
      "products",
      "tax_id",
      { type: "INTEGER", allowNull: false },
      { transaction: "transaction" },
    );
    expect(query.bulkInsert).not.toHaveBeenCalled();
  });

  it("adds the RESTRICT foreign key and the index", async () => {
    const query = queryInterfaceDouble({ taxId: 7 });

    await migration.up(query, sequelizeDouble());

    expect(query.addConstraint).toHaveBeenCalledWith("products", {
      fields: ["tax_id"],
      type: "foreign key",
      name: "products_tax_id_fkey",
      references: { table: "taxes", field: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
      transaction: "transaction",
    });
    expect(query.addIndex).toHaveBeenCalledWith("products", ["tax_id"], {
      name: "products_tax_id_idx",
      transaction: "transaction",
    });
  });

  it("creates SIN_IVA when the tax does not exist", async () => {
    const query = queryInterfaceDouble({ taxId: null, createdTaxId: 9 });

    await migration.up(query, sequelizeDouble());

    expect(query.bulkInsert).toHaveBeenCalledTimes(1);
    expect(query.bulkInsert).toHaveBeenCalledWith(
      "taxes",
      [
        expect.objectContaining({
          ...TAX_ROW,
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        }),
      ],
      { transaction: "transaction" },
    );
    expect(query.bulkUpdate).toHaveBeenCalledWith(
      "products",
      { tax_id: 9 },
      { tax_id: null },
      { transaction: "transaction" },
    );
  });

  it("runs without an explicit transaction when the dialect provides none", async () => {
    const query = queryInterfaceDouble({ taxId: 7 });
    delete query.sequelize;

    await migration.up(query, sequelizeDouble());

    expect(query.addColumn).toHaveBeenCalledWith(
      "products",
      "tax_id",
      { type: "INTEGER", allowNull: true },
      {},
    );
  });

  it("removes the index, the foreign key and the column on rollback", async () => {
    const query = queryInterfaceDouble();

    await migration.down(query);

    expect(query.removeIndex).toHaveBeenCalledWith(
      "products",
      "products_tax_id_idx",
      { transaction: "transaction" },
    );
    expect(query.removeConstraint).toHaveBeenCalledWith(
      "products",
      "products_tax_id_fkey",
      { transaction: "transaction" },
    );
    expect(query.removeColumn).toHaveBeenCalledWith("products", "tax_id", {
      transaction: "transaction",
    });
  });
});
