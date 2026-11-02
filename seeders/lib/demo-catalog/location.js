const { Op } = require("sequelize");
const City = require("../../../src/models/city");
const Currency = require("../../../src/models/currency");
const ItemState = require("../../../src/models/item-state");
const Shelf = require("../../../src/models/shelf");
const ShelfSection = require("../../../src/models/shelf-section");
const State = require("../../../src/models/state");
const Supplier = require("../../../src/models/supplier");
const Tax = require("../../../src/models/tax");
const Warehouse = require("../../../src/models/warehouse");
const { findOrCreate, options } = require("./helpers");

const SUPPLIER = Object.freeze({
  name: "Proveedor Demo",
  identification: "J-DEMO-0001",
  email: "demo@farmamad.test",
  phone: "0212-0000000",
  observations: "Proveedor creado por la semilla demo (HU-45).",
  address: "Av. Demo, Caracas",
});
const WAREHOUSE = Object.freeze({
  name: "Bodega Demo",
  address: "Galpón Demo, Zona Industrial, Caracas",
  observations: "Bodega creada por la semilla demo (HU-45).",
});
const SHELVES = Object.freeze([
  { code: "DEMO-A", name: "Estante Demo A", description: null },
  { code: "DEMO-B", name: "Estante Demo B", description: null },
]);
const SECTIONS = Object.freeze([
  { shelf: "DEMO-A", code: "DEMO-A-01", name: "Sección Demo A-01" },
  { shelf: "DEMO-A", code: "DEMO-A-02", name: "Sección Demo A-02" },
  { shelf: "DEMO-B", code: "DEMO-B-01", name: "Sección Demo B-01" },
  { shelf: "DEMO-B", code: "DEMO-B-02", name: "Sección Demo B-02" },
]);

/**
 * Resolves the base catalogs required by the demo. It fails with the exact
 * seeder to run when one is missing.
 * @param {object[]} products - Validated fixture products.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Resolved tax map, item state, currency and city.
 */
async function resolvePrerequisites(products, transaction) {
  const taxes = await Tax.findAll(options(transaction));
  const taxIds = new Map(taxes.map((tax) => [tax.code.toUpperCase(), tax.id]));
  const requiredCodes = new Set(products.map((product) => product.tax_code));
  const missingCodes = [...requiredCodes].filter((code) => !taxIds.has(code));

  if (missingCodes.length > 0) {
    throw new Error(
      `Missing taxes for the demo catalog: ${missingCodes.join(", ")}. Run the taxes seeder (HU-44) first.`,
    );
  }

  const itemState = await ItemState.findOne({
    where: { name: "sellable" },
    ...options(transaction),
  });
  if (!itemState) {
    throw new Error(
      'Item state "sellable" is missing. Run the item states seeder (HU-14) first.',
    );
  }

  const currency = await Currency.findOne({
    where: { is_default_for_transactions: true },
    ...options(transaction),
  });
  if (!currency) {
    throw new Error(
      "No default currency for transactions. Run the currencies seeder (HU-22) first.",
    );
  }

  const city = await City.findOne({
    order: [["id", "ASC"]],
    ...options(transaction),
  });
  if (!city) {
    throw new Error(
      "No cities available for the demo supplier. Run the states and cities seeders first.",
    );
  }

  const state = await State.findByPk(city.state_id, options(transaction));
  if (!state) {
    throw new Error(
      "The demo supplier city has no state. Run the states and cities seeders first.",
    );
  }

  return { taxIds, itemState, currency, city, state };
}

/**
 * Creates or reuses the demo supplier, warehouse, shelves and sections.
 * @param {object} prerequisites - Resolved city and state.
 * @param {object|null} transaction - Sequelize transaction.
 * @returns {Promise<object>} Demo location rows.
 */
async function ensureDemoLocation(prerequisites, transaction) {
  const supplier = await findOrCreate(
    Supplier,
    { identification: { [Op.iLike]: SUPPLIER.identification } },
    {
      ...SUPPLIER,
      city_id: prerequisites.city.id,
      state_id: prerequisites.state.id,
    },
    transaction,
  );
  const warehouse = await findOrCreate(
    Warehouse,
    { name: WAREHOUSE.name, address: WAREHOUSE.address },
    WAREHOUSE,
    transaction,
  );
  const shelves = new Map();
  const sections = new Map();

  for (const shelf of SHELVES) {
    const row = await findOrCreate(
      Shelf,
      { warehouse_id: warehouse.id, code: { [Op.iLike]: shelf.code } },
      { ...shelf, warehouse_id: warehouse.id },
      transaction,
    );
    shelves.set(shelf.code, row);
  }

  for (const section of SECTIONS) {
    const shelf = shelves.get(section.shelf);
    const row = await findOrCreate(
      ShelfSection,
      { shelf_id: shelf.id, code: { [Op.iLike]: section.code } },
      {
        shelf_id: shelf.id,
        code: section.code,
        name: section.name,
        description: null,
      },
      transaction,
    );
    sections.set(section.code, row);
  }

  return { supplier, warehouse, shelves, sections };
}

module.exports = {
  SECTIONS,
  SHELVES,
  SUPPLIER,
  WAREHOUSE,
  ensureDemoLocation,
  resolvePrerequisites,
};
