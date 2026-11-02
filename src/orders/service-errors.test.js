const { assertTransition } = require("./transition-policy");
const { createHttpError } = require("../shared/http-error");
const { translatePricingError } = require("./service-support");

const DRAFT = { code: "draft", next_status_code: "request" };
const REQUEST = { code: "request", next_status_code: "generate" };
const GENERATE = { code: "generate", next_status_code: "invoiced" };
const INVOICED = { code: "invoiced", next_status_code: null };
const CUSTOMER = Object.freeze({ role: "customer", userId: 12 });
const ADMIN = Object.freeze({ role: "admin", userId: 1 });
const SELLER = Object.freeze({ role: "seller", userId: 2 });

describe("order transition policy", () => {
  it("lets only the customer move draft to request", () => {
    expect(
      assertTransition({
        current: "draft",
        currentStatus: DRAFT,
        target: "request",
        context: CUSTOMER,
      }),
    ).toEqual({ kind: "request", source: "draft" });

    expect(() =>
      assertTransition({
        current: "draft",
        currentStatus: DRAFT,
        target: "request",
        context: ADMIN,
      }),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("lets admins and sellers generate directly from draft", () => {
    expect(
      assertTransition({
        current: "draft",
        currentStatus: DRAFT,
        target: "generate",
        context: ADMIN,
      }),
    ).toEqual({ kind: "generate", source: "draft" });

    expect(() =>
      assertTransition({
        current: "draft",
        currentStatus: DRAFT,
        target: "generate",
        context: CUSTOMER,
      }),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });

  it("follows the forward chain for request, generate and invoiced", () => {
    expect(
      assertTransition({
        current: "request",
        currentStatus: REQUEST,
        target: "generate",
        context: SELLER,
      }),
    ).toEqual({ kind: "generate", source: "request" });

    expect(
      assertTransition({
        current: "generate",
        currentStatus: GENERATE,
        target: "invoiced",
        context: SELLER,
      }),
    ).toEqual({ kind: "invoice", source: "generate" });

    expect(() =>
      assertTransition({
        current: "invoiced",
        currentStatus: INVOICED,
        target: "cancelled",
        context: ADMIN,
      }),
    ).toThrow(expect.objectContaining({ status: 422 }));
  });

  it("rejects repeats and invalid forward jumps", () => {
    expect(() =>
      assertTransition({
        current: "request",
        currentStatus: REQUEST,
        target: "request",
        context: CUSTOMER,
      }),
    ).toThrow(expect.objectContaining({ status: 422 }));

    expect(() =>
      assertTransition({
        current: "request",
        currentStatus: REQUEST,
        target: "invoiced",
        context: ADMIN,
      }),
    ).toThrow(expect.objectContaining({ status: 422 }));
  });

  it("lets the customer cancel only draft or request orders", () => {
    expect(
      assertTransition({
        current: "request",
        currentStatus: REQUEST,
        target: "cancelled",
        context: CUSTOMER,
      }),
    ).toEqual({ kind: "cancel", source: "request" });

    expect(() =>
      assertTransition({
        current: "generate",
        currentStatus: GENERATE,
        target: "cancelled",
        context: CUSTOMER,
      }),
    ).toThrow(expect.objectContaining({ status: 403 }));
  });
});

describe("pricing error translation", () => {
  it("maps invalid item state and missing price to the documented fields", () => {
    expect(
      translatePricingError(
        createHttpError(422, {
          errors: { item_state_id: "Invalid item state" },
        }),
      ),
    ).toMatchObject({
      status: 422,
      body: { errors: { item_state_id: "Invalid item state" } },
    });

    expect(
      translatePricingError(
        createHttpError(422, { errors: { product_id: "No price" } }),
      ),
    ).toMatchObject({
      status: 422,
      body: {
        errors: {
          product_id: "Product has no price for this item state and price list",
        },
      },
    });
  });
});
