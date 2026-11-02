process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const { Op } = require("sequelize");
const sequelize = require("../database");
const Tax = require("../models/tax");
const seeder = require("../../seeders/20260910000007-taxes");
const { assertTestDatabase } = require("../../test/helpers/test-database");

const BASE_CODES = ["IVA", "SIN_IVA"];

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

/**
 * Reads the base taxes ordered by code.
 * @returns {Promise<object[]>} Stored base tax rows.
 */
function findBaseTaxes() {
  return Tax.findAll({
    where: { code: { [Op.in]: BASE_CODES } },
    order: [["code", "ASC"]],
  });
}

describe("taxes seeder with a real database", () => {
  it("creates IVA 16 % and SIN_IVA 0 % and stays idempotent", async () => {
    const queryInterface = sequelize.getQueryInterface();

    await seeder.up(queryInterface);

    const first = await findBaseTaxes();
    const firstSnapshot = first.map((tax) => ({
      code: tax.code,
      name: tax.name,
      rate: Number(tax.rate),
      description: tax.description,
      is_active: tax.is_active,
    }));

    expect(firstSnapshot).toEqual([
      {
        code: "IVA",
        name: "Impuesto al Valor Agregado",
        rate: 16,
        description: "IVA general de Venezuela",
        is_active: true,
      },
      {
        code: "SIN_IVA",
        name: "Sin IVA",
        rate: 0,
        description: "Producto exento o no gravado",
        is_active: true,
      },
    ]);

    const totalBefore = await Tax.count();

    await seeder.up(queryInterface);
    await seeder.up(queryInterface);

    const second = await findBaseTaxes();

    expect(
      second.map((tax) => ({
        code: tax.code,
        name: tax.name,
        rate: Number(tax.rate),
        description: tax.description,
        is_active: tax.is_active,
      })),
    ).toEqual(firstSnapshot);
    await expect(Tax.count()).resolves.toBe(totalBefore);
  });
});
