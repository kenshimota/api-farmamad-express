const {
  INVALID_CUSTOMER_MESSAGE,
  INVALID_SELLER_MESSAGE,
  REQUIRED_ASSIGNMENT_FIELDS,
  UPDATE_ASSIGNMENT_FIELDS,
  createCustomerSellerSchema,
  updateCustomerSellerSchema,
} = require("./validators");
const { parseAssignmentId, parsePositiveInteger } = require("./parsers");

describe("assignment validators", () => {
  it("exposes the required fields", () => {
    expect(REQUIRED_ASSIGNMENT_FIELDS).toEqual(["customer_id", "seller_id"]);
    expect(UPDATE_ASSIGNMENT_FIELDS).toEqual(["seller_id"]);
  });

  it("accepts positive integer ids and casts numeric strings", async () => {
    await expect(
      createCustomerSellerSchema.validate({
        customer_id: "8",
        seller_id: 12,
      }),
    ).resolves.toEqual({ customer_id: 8, seller_id: 12 });
  });

  it.each([
    [{ seller_id: 12 }, "customer_id"],
    [{ customer_id: 8 }, "seller_id"],
    [{ customer_id: 0, seller_id: 12 }, "customer_id"],
    [{ customer_id: 8, seller_id: -1 }, "seller_id"],
    [{ customer_id: 1.5, seller_id: 12 }, "customer_id"],
    [{ customer_id: "abc", seller_id: 12 }, "customer_id"],
  ])("rejects invalid ids in %p with a %s error", async (body, field) => {
    await expect(
      createCustomerSellerSchema.validate(body, { abortEarly: false }),
    ).rejects.toHaveProperty("errors");
    await expect(
      createCustomerSellerSchema.validate(body, { abortEarly: false }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        expect.stringMatching(
          field === "customer_id" ? /customer/i : /seller/i,
        ),
      ]),
    });
  });

  it("uses the documented messages", async () => {
    await expect(
      createCustomerSellerSchema.validate({}, { abortEarly: false }),
    ).rejects.toMatchObject({
      errors: expect.arrayContaining([
        INVALID_CUSTOMER_MESSAGE,
        INVALID_SELLER_MESSAGE,
      ]),
    });
  });

  it("requires seller_id but keeps customer_id for the immutability check", async () => {
    await expect(updateCustomerSellerSchema.validate({})).rejects.toMatchObject(
      {
        errors: [INVALID_SELLER_MESSAGE],
      },
    );

    await expect(
      updateCustomerSellerSchema.validate(
        { seller_id: "12", customer_id: "8" },
        { stripUnknown: true },
      ),
    ).resolves.toEqual({ seller_id: 12, customer_id: "8" });
  });
});

describe("assignment parsers", () => {
  it.each([
    [1, 1],
    ["12", 12],
    [" 12 ", 12],
    [0, null],
    [-1, null],
    [1.5, null],
    ["abc", null],
    [null, null],
  ])("parses %p as %p", (value, expected) => {
    expect(parsePositiveInteger(value)).toBe(expected);
    expect(parseAssignmentId(value)).toBe(expected);
  });
});
