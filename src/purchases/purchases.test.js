const {
  AUTH_USER,
  CURRENCY,
  app,
  purchaseService,
  resetPurchaseRouterMocks,
  send,
  tokenFor,
} = require("../../test/helpers/purchase-router");
const User = require("../models/user");

beforeEach(resetPurchaseRouterMocks);

describe("POST /purchases", () => {
  it.each(["admin", "seller"])(
    "allows a %s to create a purchase and answers 201",
    async (role) => {
      const response = await send(
        "post",
        "/purchases",
        {
          supplier_id: 2,
          tax_rate: 16,
          notes: "Reposición",
          items: [
            {
              product_id: 15,
              item_state_id: 1,
              quantity: 40,
              unit_cost: 20,
              tax_amount: 128,
            },
          ],
        },
        tokenFor(role),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        id: 1,
        number: 1,
        supplier_id: 2,
        currency_id: 3,
        currency: CURRENCY,
        status: "draft",
        subtotal: 800,
        tax_amount: 128,
        total: 928,
        notes: null,
        items: [
          {
            id: 1,
            product_id: 15,
            item_state_id: 1,
            quantity: 40,
            unit_cost: 20,
            subtotal: 800,
            tax_amount: 128,
            total: 928,
          },
        ],
      });
      expect(purchaseService.createPurchase).toHaveBeenCalledWith({
        supplier_id: 2,
        notes: "Reposición",
        items: [
          {
            product_id: 15,
            item_state_id: 1,
            quantity: 40,
            unit_cost: 20,
            tax_amount: 128,
          },
        ],
      });
      expect(response.body).not.toHaveProperty("createdAt");
      expect(response.body).not.toHaveProperty("updatedAt");
    },
  );

  it("ignores server-owned fields and defaults the items to an empty array", async () => {
    await send("post", "/purchases", {
      supplier_id: 2,
      number: 99,
      status: "confirmed",
      subtotal: 1,
      tax_amount: 1,
      total: 2,
      tax_rate: 16,
      confirmed_at: "2026-10-01",
    });

    expect(purchaseService.createPurchase).toHaveBeenCalledWith({
      supplier_id: 2,
      items: [],
    });
  });

  it.each([
    [{}, "supplier_id is required"],
    [{ supplier_id: null }, "supplier_id is required"],
  ])(
    "responds 400 when supplier_id is missing in %p",
    async (body, message) => {
      const response = await send("post", "/purchases", body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ message });
      expect(purchaseService.createPurchase).not.toHaveBeenCalled();
    },
  );

  it("responds 401 and 403 for unauthorized callers", async () => {
    const anonymous = await send(
      "post",
      "/purchases",
      { supplier_id: 2 },
      null,
    );
    expect(anonymous.status).toBe(401);
    expect(anonymous.body).toEqual({ message: "Unauthorized" });

    const forbidden = await send(
      "post",
      "/purchases",
      { supplier_id: 2 },
      tokenFor("manager_warehouse"),
    );
    expect(forbidden.status).toBe(403);
    expect(forbidden.body).toEqual({ message: "Forbidden" });
  });

  it("responds 403 when the user is blocked", async () => {
    User.findByPk.mockResolvedValue({ ...AUTH_USER, isBlocked: true });

    const response = await send("post", "/purchases", { supplier_id: 2 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "User is blocked" });
  });
});
