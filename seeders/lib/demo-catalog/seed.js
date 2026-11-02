const { assertDemoAssets, copyDemoAssets } = require("./assets");
const {
  DEFAULT_ASSETS_DIR,
  DEFAULT_FIXTURE_PATH,
  loadFixture,
} = require("./fixture");
const {
  SECTIONS,
  ensureCategory,
  ensureCost,
  ensureDemoLocation,
  ensureImage,
  ensureLot,
  ensureProduct,
  ensureStock,
  resolvePrerequisites,
  verifyStocks,
} = require("./repository");

const DEFAULT_MINIMUM = 100;
const DEFAULT_LOGGER = console;

/**
 * Creates or reuses every demo category of the fixture.
 * @param {object[]} products - Validated fixture products.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<{ names: string[], categories: Map<string, object> }>} Rows.
 */
async function ensureCategories(products, transaction) {
  const names = [...new Set(products.map((item) => item.category))];
  const categories = new Map();

  for (const name of names) {
    categories.set(name, await ensureCategory(name, transaction));
  }

  return { names, categories };
}

/**
 * Creates or updates the image, product, cost, located lot and stock of one
 * fixture product, then returns its id.
 * @param {object} item - Validated fixture product.
 * @param {number} index - Product position, used to rotate sections.
 * @param {object} context - Prerequisites, location and category rows.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<number>} Product id.
 */
async function seedProduct(item, index, context, transaction) {
  const { prerequisites, location, categories, now } = context;
  const category = categories.get(item.category);
  const definition = SECTIONS[index % SECTIONS.length];
  const section = location.sections.get(definition.code);
  const shelf = location.shelves.get(definition.shelf);
  const image = await ensureImage(item, transaction);
  const product = await ensureProduct(
    item,
    {
      categoryId: category.id,
      imageId: image.id,
      taxId: prerequisites.taxIds.get(item.tax_code),
    },
    transaction,
  );

  await ensureCost(
    item,
    {
      productId: product.id,
      itemStateId: prerequisites.itemState.id,
      currencyId: prerequisites.currency.id,
    },
    transaction,
  );
  await ensureLot(
    item,
    {
      productId: product.id,
      itemStateId: prerequisites.itemState.id,
      warehouseId: location.warehouse.id,
      shelfId: shelf.id,
      sectionId: section.id,
    },
    now,
    transaction,
  );
  await ensureStock(
    {
      productId: product.id,
      itemStateId: prerequisites.itemState.id,
    },
    transaction,
  );

  return product.id;
}

/**
 * Seeds the complete demo catalog inside the caller transaction.
 * @param {object[]} products - Validated fixture products.
 * @param {{ now: Date }} settings - Deterministic timestamp.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<{ categories: number }>} Category count.
 */
async function seedDemoRows(products, { now }, transaction) {
  const prerequisites = await resolvePrerequisites(products, transaction);
  const location = await ensureDemoLocation(prerequisites, transaction);
  const { names, categories } = await ensureCategories(products, transaction);
  const context = { prerequisites, location, categories, now };
  const productIds = [];

  for (let index = 0; index < products.length; index += 1) {
    productIds.push(
      await seedProduct(products[index], index, context, transaction),
    );
  }

  await verifyStocks(productIds, prerequisites.itemState.id, transaction);

  return { categories: names.length };
}

/**
 * Seeds the demo catalog inside one transaction. Assets are validated and
 * copied before any database write, so a missing image never creates a
 * product. Re-running the seeder updates only its own stable demo keys.
 * @param {object} settings - Seed settings.
 * @param {object} settings.queryInterface - Sequelize query interface.
 * @param {string} [settings.fixturePath] - Fixture file.
 * @param {string} [settings.assetsDir] - Versioned assets folder.
 * @param {Date} [settings.now] - Deterministic seed timestamp.
 * @param {number} [settings.minimumProducts] - Minimum validated products.
 * @param {object} [settings.logger] - Logger with a `log` method.
 * @returns {Promise<object>} Seed counts and output message.
 */
async function seedDemo({
  queryInterface,
  fixturePath = DEFAULT_FIXTURE_PATH,
  assetsDir = DEFAULT_ASSETS_DIR,
  now = new Date(),
  minimumProducts = DEFAULT_MINIMUM,
  logger = DEFAULT_LOGGER,
} = {}) {
  if (!queryInterface) {
    throw new Error("seedDemo requires a Sequelize query interface.");
  }

  const { products } = await loadFixture(fixturePath, {
    minimum: minimumProducts,
  });

  await assertDemoAssets(products, assetsDir);
  await copyDemoAssets(products, assetsDir);

  const work = (transaction) => seedDemoRows(products, { now }, transaction);

  const sequelize = queryInterface.sequelize;
  const outcome = sequelize?.transaction
    ? await sequelize.transaction(work)
    : await work(null);
  const message = `Demo catalog seeded: ${products.length} products, ${products.length} images, ${outcome.categories} categories, ${products.length} lots.`;

  logger.log(message);

  return {
    products: products.length,
    images: products.length,
    categories: outcome.categories,
    lots: products.length,
    message,
  };
}

module.exports = { DEFAULT_MINIMUM, seedDemo };
