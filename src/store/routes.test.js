const { createHttpError } = require("../shared/http-error");
const { createListHandler } = require("./list");
const { createDetailHandler } = require("./detail");
const storeRouter = require("./index");

/**
 * Builds a response double.
 * @returns {object} Express-like response.
 */
function responseDouble() {
  const res = {
    statusCode: 200,
    body: undefined,
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
  };

  return res;
}

/**
 * Builds a request double.
 * @param {object} [overrides] - Request overrides.
 * @returns {object} Express-like request.
 */
function requestDouble(overrides = {}) {
  return {
    query: {},
    params: {},
    currentUser: { id: 10, role: { name: "customer" } },
    ...overrides,
  };
}

const CONTEXT = {
  customerId: 8,
  priceList: { id: 4, percentage: "30.00" },
};

describe("store router", () => {
  it("mounts the product listing and detail routers", () => {
    expect(storeRouter).toBeInstanceOf(Function);
    expect(storeRouter.stack.length).toBeGreaterThanOrEqual(2);
  });
});

describe("createListHandler", () => {
  it("answers the catalog for the resolved customer", async () => {
    const loadCatalog = jest.fn().mockResolvedValue([{ id: 15 }]);
    const handler = createListHandler({
      repository: {
        findItemState: jest
          .fn()
          .mockResolvedValue({ id: 2, is_sellable: true }),
      },
      resolveCustomer: jest.fn().mockResolvedValue(CONTEXT),
      loadCatalog,
    });
    const res = responseDouble();

    await handler(requestDouble({ query: { item_state_id: "2" } }), res);

    expect(loadCatalog).toHaveBeenCalledWith({
      repository: expect.objectContaining({
        findItemState: expect.any(Function),
      }),
      priceList: CONTEXT.priceList,
      itemStateId: 2,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([{ id: 15 }]);
  });

  it("rejects an invalid item_state_id format before resolving access", async () => {
    const resolveCustomer = jest.fn();
    const handler = createListHandler({ repository: {}, resolveCustomer });
    const res = responseDouble();

    await handler(requestDouble({ query: { item_state_id: "abc" } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      errors: { item_state_id: "Invalid item state id" },
    });
    expect(resolveCustomer).not.toHaveBeenCalled();
  });

  it("rejects an item state that is missing or not sellable", async () => {
    const handler = createListHandler({
      repository: {
        findItemState: jest.fn().mockResolvedValue({
          id: 2,
          is_sellable: false,
        }),
      },
      resolveCustomer: jest.fn().mockResolvedValue(CONTEXT),
      loadCatalog: jest.fn(),
    });
    const res = responseDouble();

    await handler(requestDouble({ query: { item_state_id: "2" } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      errors: { item_state_id: "Invalid item state" },
    });
  });

  it("forwards the HTTP error raised by the access guard", async () => {
    const handler = createListHandler({
      repository: {},
      resolveCustomer: jest
        .fn()
        .mockRejectedValue(
          createHttpError(403, {
            message: "Customer price list is not assigned",
          }),
        ),
    });
    const res = responseDouble();

    await handler(requestDouble(), res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      message: "Customer price list is not assigned",
    });
  });

  it("rethrows unexpected errors so the global handler answers 500", async () => {
    const error = new Error("boom");
    const handler = createListHandler({
      repository: {},
      resolveCustomer: jest.fn().mockRejectedValue(error),
    });
    const res = responseDouble();

    await expect(handler(requestDouble(), res)).rejects.toBe(error);
  });
});

describe("createDetailHandler", () => {
  it("answers the product detail", async () => {
    const loadDetail = jest.fn().mockResolvedValue({ id: 15, variants: [] });
    const handler = createDetailHandler({
      repository: {
        findItemState: jest
          .fn()
          .mockResolvedValue({ id: 2, is_sellable: true }),
      },
      resolveCustomer: jest.fn().mockResolvedValue(CONTEXT),
      loadDetail,
    });
    const res = responseDouble();

    await handler(
      requestDouble({ params: { id: "15" }, query: { item_state_id: "2" } }),
      res,
    );

    expect(loadDetail).toHaveBeenCalledWith({
      repository: expect.objectContaining({
        findItemState: expect.any(Function),
      }),
      productId: 15,
      priceList: CONTEXT.priceList,
      itemStateId: 2,
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ id: 15, variants: [] });
  });

  it("rejects an invalid product id", async () => {
    const handler = createDetailHandler({ repository: {} });
    const res = responseDouble();

    await handler(requestDouble({ params: { id: "0" } }), res);

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({ errors: { id: "Invalid product id" } });
  });

  it("rejects an invalid item_state_id format", async () => {
    const handler = createDetailHandler({ repository: {} });
    const res = responseDouble();

    await handler(
      requestDouble({ params: { id: "15" }, query: { item_state_id: "0" } }),
      res,
    );

    expect(res.statusCode).toBe(422);
    expect(res.body).toEqual({
      errors: { item_state_id: "Invalid item state id" },
    });
  });

  it("answers 404 when the detail loader reports a missing product", async () => {
    const handler = createDetailHandler({
      repository: {},
      resolveCustomer: jest.fn().mockResolvedValue(CONTEXT),
      loadDetail: jest
        .fn()
        .mockRejectedValue(
          createHttpError(404, { message: "Product not found" }),
        ),
    });
    const res = responseDouble();

    await handler(requestDouble({ params: { id: "15" } }), res);

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ message: "Product not found" });
  });
});
