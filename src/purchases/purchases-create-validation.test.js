const {
  purchaseService,
  resetPurchaseRouterMocks,
  send,
} = require("../../test/helpers/purchase-router");

beforeEach(resetPurchaseRouterMocks);

describe("POST /purchases validation", () => {
  it.each([
    { supplier_id: 2, notes: "x".repeat(1001) },
    { supplier_id: 2, items: "nope" },
    {
      supplier_id: 2,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 0,
          unit_cost: 10,
          tax_amount: 0,
        },
      ],
    },
    {
      supplier_id: 2,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 1,
          unit_cost: 12.345,
          tax_amount: 0,
        },
      ],
    },
    {
      supplier_id: 2,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 1,
          unit_cost: 10,
          tax_amount: -1,
        },
      ],
    },
    {
      supplier_id: 2,
      items: [
        {
          product_id: 15,
          item_state_id: 1,
          quantity: 1,
          unit_cost: 10,
          tax_amount: 1.234,
        },
      ],
    },
  ])("responds 422 for invalid body %p", async (body) => {
    const response = await send("post", "/purchases", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
    expect(purchaseService.createPurchase).not.toHaveBeenCalled();
  });

  it("responds 422 with the nested path when a line omits tax_amount", async () => {
    const response = await send("post", "/purchases", {
      supplier_id: 2,
      items: [{ product_id: 15, item_state_id: 1, quantity: 1, unit_cost: 10 }],
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { "items.0.tax_amount": "tax_amount is required" },
    });
    expect(purchaseService.createPurchase).not.toHaveBeenCalled();
  });

  it("maps service conflicts and validation errors", async () => {
    purchaseService.createPurchase.mockRejectedValueOnce({
      status: 409,
      body: { message: "Item already exists" },
    });

    const conflict = await send("post", "/purchases", { supplier_id: 2 });
    expect(conflict.status).toBe(409);
    expect(conflict.body).toEqual({ message: "Item already exists" });

    purchaseService.createPurchase.mockRejectedValueOnce({
      status: 422,
      body: { errors: { supplier_id: "Invalid supplier id" } },
    });

    const invalid = await send("post", "/purchases", { supplier_id: 99 });
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { supplier_id: "Invalid supplier id" },
    });
  });
});
