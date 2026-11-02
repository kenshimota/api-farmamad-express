process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { Op } = require("sequelize");
const sequelize = require("../database");
const Product = require("../models/product");
const Image = require("../models/image");
const Category = require("../models/category");
const Supplier = require("../models/supplier");
const Warehouse = require("../models/warehouse");
const Shelf = require("../models/shelf");
const ShelfSection = require("../models/shelf-section");
const Cost = require("../models/cost");
const Lot = require("../models/lot");
const Stock = require("../models/stock");
const Tax = require("../models/tax");
const ItemState = require("../models/item-state");
const User = require("../models/user");
const Customer = require("../models/customer");
const Order = require("../models/order");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const {
  DEMO_IMAGE,
  DEMO_REFERENCE,
  countDemoRows,
} = require("../../test/helpers/demo-catalog");
const demoFixture = require("../../seeders/data/demo-products.json");
const statesSeeder = require("../../seeders/20260910000002-states-venezuela");
const citiesSeeder = require("../../seeders/20260910000003-cities-venezuela");
const itemStatesSeeder = require("../../seeders/20260910000004-item-states");
const currenciesSeeder = require("../../seeders/20260910000005-currencies");
const taxesSeeder = require("../../seeders/20260910000007-taxes");
const { seedDemo } = require("../../seeders/lib/demo-catalog/seed");
const { removeDemo } = require("../../seeders/lib/demo-catalog/remove");

jest.setTimeout(60000);

let workDirectory;
let uploadDirectory;
let queryInterface;

async function seed(options = {}) {
  return seedDemo({
    queryInterface,
    now: new Date("2026-11-02T12:00:00.000Z"),
    ...options,
  });
}

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
  workDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "hu45-"));
  uploadDirectory = path.join(workDirectory, "uploads");
  process.env.UPLOAD_DIR = uploadDirectory;
  process.env.PUBLIC_BASE_URL = "https://api.farmamad.test";
  queryInterface = sequelize.getQueryInterface();

  // Other integration suites may truncate these catalogs, so this suite
  // prepares its own prerequisites and never depends on file execution order.
  for (const seeder of [
    statesSeeder,
    citiesSeeder,
    itemStatesSeeder,
    currenciesSeeder,
    taxesSeeder,
  ]) {
    await seeder.up(queryInterface);
  }
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await removeDemo({ queryInterface });
});

afterAll(async () => {
  await removeDemo({ queryInterface }).catch(() => undefined);
  await fs.rm(workDirectory, { recursive: true, force: true });
  delete process.env.UPLOAD_DIR;
  delete process.env.PUBLIC_BASE_URL;
  await sequelize.close();
});

describe("demo catalog seeder with a real database", () => {
  it("loads 100+ products with tax, image, cost, located lot and coherent stock", async () => {
    const usersBefore = await User.count();
    const customersBefore = await Customer.count();
    const ordersBefore = await Order.count();

    const result = await seed();

    expect(result.products).toBeGreaterThanOrEqual(100);
    expect(result.images).toBe(result.products);
    expect(result.lots).toBe(result.products);
    expect(result.message).toMatch(
      /^Demo catalog seeded: \d+ products, \d+ images, \d+ categories, \d+ lots\.$/,
    );

    const products = await Product.findAll({
      where: { reference: DEMO_REFERENCE },
      include: [
        { model: Tax, as: "tax" },
        { model: Image, as: "image" },
      ],
    });
    const sellable = await ItemState.findOne({ where: { name: "sellable" } });
    const uploadFiles = await fs.readdir(
      path.join(uploadDirectory, "products", "demo"),
    );
    const stockRows = await sequelize.query(
      `SELECT stocks.product_id, stocks.quantity, COALESCE(SUM(lots.stock), 0) AS lot_stock
       FROM stocks
       LEFT JOIN lots ON lots.product_id = stocks.product_id
         AND lots.item_state_id = stocks.item_state_id
       WHERE stocks.item_state_id = :itemStateId
       GROUP BY stocks.product_id, stocks.quantity`,
      {
        replacements: { itemStateId: sellable.id },
        type: sequelize.QueryTypes.SELECT,
      },
    );

    expect(products.length).toBeGreaterThanOrEqual(100);
    expect(products.every((product) => product.tax_id !== null)).toBe(true);
    expect(
      products.every((product) =>
        ["IVA", "SIN_IVA"].includes(product.tax.code),
      ),
    ).toBe(true);
    expect(
      uploadFiles.filter((file) => file.endsWith("-thumb.webp")),
    ).toHaveLength(products.length);
    expect(products[0].image.url).toMatch(
      /^https:\/\/api\.farmamad\.test\/uploads\/products\/demo\/.+\.webp$/,
    );

    for (const product of products) {
      const lot = await Lot.findOne({
        where: { product_id: product.id, item_state_id: sellable.id },
      });
      const cost = await Cost.findOne({
        where: { product_id: product.id, item_state_id: sellable.id },
      });

      expect(lot).not.toBeNull();
      expect(lot.number).toBe(`LOTE-DEMO-${product.reference.slice(10)}`);
      expect(lot.warehouse_id).not.toBeNull();
      expect(lot.shelf_id).not.toBeNull();
      expect(lot.section_id).not.toBeNull();
      expect(cost).not.toBeNull();
    }

    expect(await User.count()).toBe(usersBefore);
    expect(await Customer.count()).toBe(customersBefore);
    expect(await Order.count()).toBe(ordersBefore);

    const demoStocks = stockRows.filter((row) =>
      products.some((product) => product.id === row.product_id),
    );
    expect(demoStocks.length).toBeGreaterThanOrEqual(100);
    for (const row of demoStocks) {
      expect(Number(row.quantity)).toBe(Number(row.lot_stock));
    }
  });

  it("is idempotent and keeps exactly the same row counts", async () => {
    await seed();
    const first = await countDemoRows();

    const secondResult = await seed();
    const second = await countDemoRows();

    expect(second).toEqual(first);
    expect(secondResult.products).toBeGreaterThanOrEqual(100);
  });

  it("rolls back every row when a product fails inside the transaction", async () => {
    const originalCreate = Product.create;
    let calls = 0;
    const spy = jest.spyOn(Product, "create").mockImplementation(function (
      ...args
    ) {
      calls += 1;

      if (calls === 2) {
        return Promise.reject(new Error("forced product failure"));
      }

      return originalCreate.apply(this, args);
    });

    try {
      await expect(seed()).rejects.toThrow("forced product failure");
    } finally {
      spy.mockRestore();
    }

    expect(await Product.count({ where: { reference: DEMO_REFERENCE } })).toBe(
      0,
    );
    expect(await Image.count({ where: { reference: DEMO_IMAGE } })).toBe(0);
  });

  it("fails before inserting when a fixture image is missing or corrupt", async () => {
    const fixturePath = path.join(workDirectory, "bad-fixture.json");
    const assetsDir = path.join(workDirectory, "bad-assets");
    await fs.mkdir(assetsDir, { recursive: true });
    await fs.writeFile(
      fixturePath,
      JSON.stringify({
        products: [
          {
            external_id: "999001",
            name: "Producto sin imagen",
            description: "Prueba",
            reference: "FARMATODO-999001",
            category: "Medicamentos",
            tax_code: "IVA",
            cost: 1,
            image: {
              original: "999001.webp",
              thumbnail: "999001-thumb.webp",
              reference: "demo-farmatodo-999001",
            },
            source_url: "https://example.com/999001",
            fetched_at: "2026-11-02T12:00:00.000Z",
          },
        ],
      }),
      "utf8",
    );

    await expect(
      seed({ fixturePath, assetsDir, minimumProducts: 1 }),
    ).rejects.toThrow(/missing|valid image/i);

    expect(
      await Product.count({ where: { reference: "FARMATODO-999001" } }),
    ).toBe(0);
  });

  it("removes only demo rows and preserves shared categories and real products", async () => {
    await Product.destroy({
      where: { reference: { [Op.like]: "REAL-%" } },
      cascade: true,
    });
    await Image.destroy({
      where: { reference: { [Op.like]: "real-product-image%" } },
      cascade: true,
    });
    await seed();
    const demoCategory = await Category.findOne({
      where: { name: demoFixture.products[0].category },
    });
    const tax = await Tax.findOne({ where: { code: "IVA" } });
    const suffix = Date.now();
    const realImage = await Image.create({
      url: "https://api.farmamad.test/uploads/products/real.webp",
      pathname: "/uploads/products/real.webp",
      reference: `real-product-image-${suffix}`,
      thumbnail: "https://api.farmamad.test/uploads/products/real-thumb.webp",
    });
    const realProduct = await Product.create({
      name: "Producto real",
      description: "No debe borrarse",
      reference: `REAL-${suffix}`,
      category_id: demoCategory.id,
      image_id: realImage.id,
      tax_id: tax.id,
    });

    await removeDemo({ queryInterface });

    expect(await Product.count({ where: { reference: DEMO_REFERENCE } })).toBe(
      0,
    );
    expect(await Image.count({ where: { reference: DEMO_IMAGE } })).toBe(0);
    expect(await Product.findByPk(realProduct.id)).not.toBeNull();
    expect(await Category.findByPk(demoCategory.id)).not.toBeNull();
    expect(await Supplier.count()).toBe(0);
    expect(await Warehouse.count()).toBe(0);

    await realProduct.destroy();
    await realImage.destroy();
  });
});
