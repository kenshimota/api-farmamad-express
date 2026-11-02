process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { QueryTypes } = require("sequelize");
const { ForeignKeyConstraintError } = require("sequelize");
const Sequelize = require("sequelize");
const sequelize = require("../database");
const Product = require("../models/product");
const Tax = require("../models/tax");
const migration = require("../../migrations/20260910000046-add-tax-id-to-products");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  createProduct,
  ensureDefaultTax,
  resetDatabase,
} = require("../../test/helpers/products");
const { createTax } = require("../../test/helpers/taxes");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe("products.tax_id with a real database", () => {
  it("creates the column as NOT NULL with its index", async () => {
    const queryInterface = sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable("products");
    const indexes = await queryInterface.showIndex("products");

    expect(columns.tax_id).toMatchObject({ allowNull: false });
    expect(columns.tax_id.type).toMatch(/INTEGER/i);
    expect(indexes.map((index) => index.name)).toContain("products_tax_id_idx");
  });

  it("restricts the deletion of a tax assigned to a product", async () => {
    const tax = await createTax();
    const product = await createProduct({ tax_id: tax.id });

    await expect(tax.destroy()).rejects.toBeInstanceOf(
      ForeignKeyConstraintError,
    );
    await expect(Tax.findByPk(tax.id)).resolves.not.toBeNull();
    await expect(Product.findByPk(product.id)).resolves.not.toBeNull();
  });

  it("backfills existing products with SIN_IVA before making the column required", async () => {
    const queryInterface = sequelize.getQueryInterface();
    const customTax = await createTax();
    const product = await createProduct({ tax_id: customTax.id });
    let reverted = false;

    try {
      await migration.down(queryInterface);

      const dropped = await queryInterface.describeTable("products");
      expect(dropped.tax_id).toBeUndefined();

      reverted = true;
      await migration.up(queryInterface, Sequelize);

      const defaultTax = await ensureDefaultTax();
      const [row] = await sequelize.query(
        "SELECT tax_id FROM products WHERE id = :id",
        {
          replacements: { id: product.id },
          type: QueryTypes.SELECT,
        },
      );

      expect(row.tax_id).toBe(defaultTax.id);

      const restored = await queryInterface.describeTable("products");
      expect(restored.tax_id).toMatchObject({ allowNull: false });
    } finally {
      if (reverted) {
        const columns = await queryInterface.describeTable("products");

        if (columns.tax_id === undefined) {
          await migration.up(queryInterface, Sequelize);
        }
      }
    }
  });
});
