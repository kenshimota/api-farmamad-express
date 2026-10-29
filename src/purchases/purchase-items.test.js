process.env.JWT_SECRET = "test-secret";

jest.mock("../models/purchase", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/purchase-item", () => ({
  create: jest.fn(),
  bulkCreate: jest.fn(),
  findAll: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/product", () => ({ findByPk: jest.fn() }));
jest.mock("../models/item-state", () => ({ findByPk: jest.fn() }));
jest.mock("../models/cost", () => ({
  findOne: jest.fn(),
  upsert: jest.fn(),
}));
jest.mock("../models/user", () => ({ findByPk: jest.fn() }));
jest.mock("./purchase-service", () => ({
  purchaseService: {
    listPurchases: jest.fn(),
    getPurchase: jest.fn(),
    createPurchase: jest.fn(),
    updatePurchase: jest.fn(),
    deletePurchase: jest.fn(),
    cancelPurchase: jest.fn(),
    confirmPurchase: jest.fn(),
    listItems: jest.fn(),
    addItem: jest.fn(),
    updateItem: jest.fn(),
    deleteItem: jest.fn(),
  },
}));

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const { purchaseService } = require("./purchase-service");
const purchasesRouter = require("./index");

const app = express();
app.use(express.json());
app.use("/purchases", purchasesRouter);
app.use((error, req, res, next) => {
  res.status(500).json({ message: "Server error" });
});

const SECRET = "test-secret";
const AUTH_USER = { id: 1, username: "admin", isBlocked: false };
const ITEM = {
  id: 4,
  purchase_id: 1,
  product_id: 15,
  item_state_id: 1,
  quantity: 2,
  unit_cost: "10.00",
  subtotal: "20.00",
  tax_amount: "3.20",
};
const PURCHASE = {
  id: 1,
  number: 1,
  supplier_id: 2,
  status: "draft",
  subtotal: "20.00",
  tax_amount: "3.20",
  total: "23.20",
  notes: null,
  items: [ITEM],
};
const BODY = {
  product_id: 15,
  item_state_id: 1,
  quantity: 2,
  unit_cost: 10,
  tax_amount: 3.2,
};

/**
 * Signs a JWT for the given role.
 * @param {string} [role] - Role name.
 * @returns {string} Signed JWT.
 */
function tokenFor(role = "admin") {
  return jwt.sign({ sub: 1, username: "admin", role }, SECRET, {
    expiresIn: "1h",
  });
}

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method.
 * @param {string} path - Request path.
 * @param {object} [body] - Request body.
 * @param {string|null} [token] - Bearer token; null omits it.
 * @returns {Promise<import("supertest").Response>} HTTP response.
 */
function send(method, path, body, token = tokenFor()) {
  const req = request(app)[method](path);

  return token
    ? req.set("Authorization", `Bearer ${token}`).send(body)
    : req.send(body);
}

beforeEach(() => {
  jest.clearAllMocks();
  User.findByPk.mockResolvedValue(AUTH_USER);
  purchaseService.listItems.mockResolvedValue([ITEM]);
  purchaseService.addItem.mockResolvedValue(PURCHASE);
  purchaseService.updateItem.mockResolvedValue(PURCHASE);
  purchaseService.deleteItem.mockResolvedValue();
});

describe("GET /purchases/:id/items", () => {
  it("returns the lines for the allowed read roles", async () => {
    const response = await send(
      "get",
      "/purchases/1/items",
      undefined,
      tokenFor("manager_warehouse"),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      {
        id: 4,
        product_id: 15,
        item_state_id: 1,
        quantity: 2,
        unit_cost: 10,
        subtotal: 20,
        tax_amount: 3.2,
        total: 23.2,
      },
    ]);
    expect(purchaseService.listItems).toHaveBeenCalledWith(1);
  });

  it("maps 404, 409, 422, 401 and 403", async () => {
    purchaseService.listItems.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });
    expect((await send("get", "/purchases/99/items")).status).toBe(404);

    purchaseService.listItems.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
    expect((await send("get", "/purchases/1/items")).status).toBe(409);

    expect((await send("get", "/purchases/abc/items")).status).toBe(422);
    expect(
      (await send("get", "/purchases/1/items", undefined, null)).status,
    ).toBe(401);
    expect(
      (await send("get", "/purchases/1/items", undefined, tokenFor("support")))
        .status,
    ).toBe(403);
  });
});

describe("POST /purchases/:id/items", () => {
  it.each(["admin", "seller"])(
    "allows a %s to add a line and answers 201",
    async (role) => {
      const response = await send(
        "post",
        "/purchases/1/items",
        BODY,
        tokenFor(role),
      );

      expect(response.status).toBe(201);
      expect(purchaseService.addItem).toHaveBeenCalledWith(1, BODY);
      expect(response.body.items).toHaveLength(1);
    },
  );

  it("responds 400 when tax_amount is missing", async () => {
    const { tax_amount, ...withoutTax } = BODY;
    const response = await send("post", "/purchases/1/items", withoutTax);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "product_id, item_state_id, quantity, unit_cost and tax_amount are required",
    });
    expect(purchaseService.addItem).not.toHaveBeenCalled();
  });

  it("responds 400 when a line field is missing", async () => {
    const response = await send("post", "/purchases/1/items", {
      product_id: 15,
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message:
        "product_id, item_state_id, quantity, unit_cost and tax_amount are required",
    });
    expect(purchaseService.addItem).not.toHaveBeenCalled();
  });

  it.each([
    { ...BODY, quantity: 0 },
    { ...BODY, quantity: 1000001 },
    { ...BODY, quantity: 1.5 },
    { ...BODY, unit_cost: -1 },
    { ...BODY, unit_cost: 1.234 },
    { ...BODY, product_id: 0 },
    { ...BODY, tax_amount: -1 },
    { ...BODY, tax_amount: 1.234 },
    { ...BODY, tax_amount: 10000000000 },
  ])("responds 422 for invalid line %p", async (body) => {
    const response = await send("post", "/purchases/1/items", body);

    expect(response.status).toBe(422);
    expect(response.body.errors).toBeDefined();
  });

  it("maps duplicate, reference, missing and non-draft errors", async () => {
    purchaseService.addItem.mockRejectedValueOnce({
      status: 409,
      body: { message: "Item already exists" },
    });
    const duplicate = await send("post", "/purchases/1/items", BODY);
    expect(duplicate.status).toBe(409);

    purchaseService.addItem.mockRejectedValueOnce({
      status: 422,
      body: { errors: { product_id: "Invalid product id" } },
    });
    const invalid = await send("post", "/purchases/1/items", BODY);
    expect(invalid.status).toBe(422);

    purchaseService.addItem.mockRejectedValueOnce({
      status: 404,
      body: { message: "Purchase not found" },
    });
    expect((await send("post", "/purchases/99/items", BODY)).status).toBe(404);

    purchaseService.addItem.mockRejectedValueOnce({
      status: 409,
      body: { message: "Purchase is not editable" },
    });
    expect((await send("post", "/purchases/1/items", BODY)).status).toBe(409);
  });

  it("responds 422 for an invalid purchase id", async () => {
    const response = await send("post", "/purchases/abc/items", BODY);

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { id: "Invalid purchase id" } });
  });
});
