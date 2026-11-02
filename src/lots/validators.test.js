const { createLotSchema, updateLotSchema } = require("./validators");
const {
  isCalendarDate,
  parseExpired,
  parseExpiringBefore,
  parseLocationStatus,
  parseLotId,
  parseNumberFilter,
  parsePositiveInteger,
} = require("./parsers");

describe("lot validators", () => {
  it("parses positive integers from numbers and strings", () => {
    expect(parsePositiveInteger(3)).toBe(3);
    expect(parsePositiveInteger(0)).toBeNull();
    expect(parsePositiveInteger(1.5)).toBeNull();
    expect(parsePositiveInteger(" 03 ")).toBe(3);
    expect(parsePositiveInteger("abc")).toBeNull();
    expect(parsePositiveInteger("0")).toBeNull();
    expect(parsePositiveInteger(null)).toBeNull();
    expect(parseLotId("9")).toBe(9);
  });

  it("parses the number filter with trimming and length limits", () => {
    expect(parseNumberFilter(" L-1 ")).toBe("L-1");
    expect(parseNumberFilter("")).toBeNull();
    expect(parseNumberFilter("x".repeat(101))).toBeNull();
    expect(parseNumberFilter(10)).toBeNull();
  });

  it("parses only the literal expired flags", () => {
    expect(parseExpired(true)).toBe(true);
    expect(parseExpired("false")).toBe(false);
    expect(parseExpired(" TRUE ")).toBe(true);
    expect(parseExpired("maybe")).toBeUndefined();
    expect(parseExpired(1)).toBeUndefined();
  });

  it("parses only the three location statuses", () => {
    expect(parseLocationStatus(" pending ")).toBe("pending");
    expect(parseLocationStatus("in_progress")).toBe("in_progress");
    expect(parseLocationStatus("located")).toBe("located");
    expect(parseLocationStatus("all")).toBeNull();
    expect(parseLocationStatus(1)).toBeNull();
  });

  it("parses expiring_before as a real calendar date", () => {
    expect(parseExpiringBefore(" 2027-01-31 ")).toBe("2027-01-31");
    expect(parseExpiringBefore("2026-02-30")).toBeNull();
    expect(parseExpiringBefore("31-01-2027")).toBeNull();
    expect(parseExpiringBefore(20270131)).toBeNull();
    expect(isCalendarDate("2024-02-29")).toBe(true);
    expect(isCalendarDate("2025-02-29")).toBe(false);
  });

  it("defaults stock to zero and strips reserved on create", async () => {
    const values = await createLotSchema.validate(
      {
        number: " L-1 ",
        product_id: 1,
        expiration_date: "2027-03-31",
        item_state_id: 1,
        warehouse_id: 1,
        shelf_id: 1,
        section_id: 2,
        id: 99,
      },
      { stripUnknown: true },
    );

    expect(values).toEqual({
      number: "L-1",
      product_id: 1,
      expiration_date: "2027-03-31",
      item_state_id: 1,
      stock: 0,
      warehouse_id: 1,
      shelf_id: 1,
      section_id: 2,
    });
  });

  it("accepts an already expired date", async () => {
    await expect(
      createLotSchema.validate({
        number: "L-1",
        product_id: 1,
        expiration_date: "2020-01-01",
        item_state_id: 1,
        warehouse_id: 1,
        shelf_id: 1,
        section_id: 2,
      }),
    ).resolves.toBeTruthy();
  });

  it("ignores reserved because it is immutable through the API", async () => {
    const values = await updateLotSchema.validate(
      {
        number: "L-1",
        product_id: 1,
        expiration_date: "2027-03-31",
        item_state_id: 1,
        stock: 1,
        reserved: 2,
        warehouse_id: 1,
        shelf_id: 1,
        section_id: 2,
      },
      { abortEarly: false, stripUnknown: true },
    );

    expect(values).not.toHaveProperty("reserved");
    expect(values.stock).toBe(1);
  });
});
