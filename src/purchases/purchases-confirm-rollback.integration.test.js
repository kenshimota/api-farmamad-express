process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Cost = require("../models/cost");
const Purchase = require("../models/purchase");
const Stock = require("../models/stock");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
  ensureDefaultTransactionCurrency,
  resetDatabase,
  tokenFor,
} = require("../../test/helpers/purchases");

beforeAll(async () => {
  assertTestDatabase(sequelize.config.database);
  await sequelize.authenticate();
});

beforeEach(async () => {
  assertTestDatabase(sequelize.config.database);
  await resetDatabase();
});

afterEach(() => {
  jest.restoreAllMocks();
});

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

/**
 * Builds the references needed by a confirmation.
 * @returns {Promise<object>} Supplier, product and item state.
 */
async function references() {
  const suffix = Math.random().toString(36).slice(2, 8);

  return {
    supplier: await createPurchaseSupplier(),
    product: await createProduct({ reference: `ROLLBACK-${suffix}` }),
    itemState: await createItemState({
      name: `state_${suffix}`,
      label: `Estado ${suffix}`,
      is_sellable: true,
    }),
  };
}

/**
 * Adds one line to a purchase.
 * @param {object} purchase - Purchase instance.
 * @param {object} refs - References.
 * @param {number} quantity - Quantity to add.
 * @param {number} unitCost - Unit cost.
 * @param {number} [taxAmount] - Absolute tax amount of the line.
 * @returns {Promise<object>} The created line.
 */
function addLine(purchase, refs, quantity, unitCost, taxAmount = 0) {
  return createPurchaseItem({
    purchase_id: purchase.id,
    product_id: refs.product.id,
    item_state_id: refs.itemState.id,
    quantity,
    unit_cost: unitCost,
    subtotal: quantity * unitCost,
    tax_amount: taxAmount,
  });
}

describe("confirmation rollback", () => {
  it("rolls back costs and a stock increment already applied when a later line fails", async () => {
    const refs = await references();
    const suffix = Math.random().toString(36).slice(2, 8);
    const secondState = await createItemState({
      name: `state_${suffix}_b`,
      label: `Estado ${suffix} B`,
      is_sellable: true,
    });
    const firstStock = {
      product_id: refs.product.id,
      item_state_id: refs.itemState.id,
    };
    const secondStock = {
      product_id: refs.product.id,
      item_state_id: secondState.id,
    };

    await Cost.create({
      ...firstStock,
      cost: 5,
      currency_id: (await ensureDefaultTransactionCurrency()).id,
    });
    await Stock.create({ ...firstStock, quantity: 10 });
    await Stock.create({ ...secondStock, quantity: 3 });

    const purchase = await createPurchase({ supplier_id: refs.supplier.id });
    await addLine(purchase, refs, 4, 25, 100);
    await addLine(purchase, { ...refs, itemState: secondState }, 7, 10, 70);

    const originalIncrement = Stock.prototype.increment;
    let calls = 0;
    jest
      .spyOn(Stock.prototype, "increment")
      .mockImplementation(function increment(...args) {
        calls += 1;
        if (calls === 2) {
          return Promise.reject(new Error("second stock failure"));
        }
        return originalIncrement.apply(this, args);
      });

    const token = await tokenFor("admin");
    const response = await as(
      "post",
      `/purchases/${purchase.id}/confirm`,
      token,
    );

    expect(response.status).toBe(500);
    const stored = await Purchase.findByPk(purchase.id);
    expect(stored.status).toBe("draft");
    expect(stored.confirmed_at).toBeNull();

    const first = await Stock.findOne({ where: firstStock });
    const second = await Stock.findOne({ where: secondStock });
    const cost = await Cost.findOne({ where: firstStock });

    expect(first.quantity).toBe(10);
    expect(second.quantity).toBe(3);
    expect(Number(cost.cost)).toBe(5);
    expect(await Cost.count()).toBe(1);
  });
});
