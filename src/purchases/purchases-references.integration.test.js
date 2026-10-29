process.env.JWT_SECRET = process.env.JWT_SECRET || "integration-test-secret";

const sequelize = require("../database");
const Supplier = require("../models/supplier");
const ItemState = require("../models/item-state");
const { assertTestDatabase } = require("../../test/helpers/test-database");
const { createProduct } = require("../../test/helpers/products");
const { createItemState } = require("../../test/helpers/item-states");
const {
  as,
  createPurchase,
  createPurchaseItem,
  createPurchaseSupplier,
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

afterAll(async () => {
  await resetDatabase();
  await sequelize.close();
});

describe("references activated by purchases", () => {
  it("prevents deleting a supplier referenced by a purchase", async () => {
    const supplier = await createPurchaseSupplier();
    await createPurchase({ supplier_id: supplier.id });
    const token = await tokenFor("admin");

    const response = await as("delete", `/suppliers/${supplier.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Supplier is in use" });
    await expect(Supplier.findByPk(supplier.id)).resolves.not.toBeNull();
  });

  it("prevents deleting an item state referenced by a purchase line", async () => {
    const itemState = await createItemState({
      name: "sellable",
      label: "Vendible",
    });
    const product = await createProduct({ reference: "REF-ITEM-STATE" });
    const purchase = await createPurchase();
    await createPurchaseItem({
      purchase_id: purchase.id,
      product_id: product.id,
      item_state_id: itemState.id,
    });
    const token = await tokenFor("admin");

    const response = await as("delete", `/item-states/${itemState.id}`, token);

    expect(response.status).toBe(409);
    expect(response.body).toEqual({ message: "Item state is in use" });
    await expect(ItemState.findByPk(itemState.id)).resolves.not.toBeNull();
  });
});
