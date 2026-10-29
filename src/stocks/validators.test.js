const {
  IN_STOCK_MESSAGE,
  ITEM_STATE_FILTER_MESSAGE,
  PRODUCT_FILTER_MESSAGE,
  parseInStock,
  parseItemStateId,
  parseProductId,
  parseStockId,
} = require("./validators");

describe("stock id parsers", () => {
  it.each([
    ["1", 1],
    ["15", 15],
    [7, 7],
    ["  8  ", 8],
  ])("parses %p as the positive integer %p", (value, expected) => {
    expect(parseStockId(value)).toBe(expected);
    expect(parseProductId(value)).toBe(expected);
    expect(parseItemStateId(value)).toBe(expected);
  });

  it.each([null, undefined, "", "abc", "0", "-1", "1.5", 0, -2, 1.2, {}, []])(
    "rejects %p",
    (value) => {
      expect(parseStockId(value)).toBeNull();
      expect(parseProductId(value)).toBeNull();
      expect(parseItemStateId(value)).toBeNull();
    },
  );
});

describe("parseInStock", () => {
  it.each([
    [true, true],
    [false, false],
    ["true", true],
    ["false", false],
    [" TRUE ", true],
    [" False ", false],
  ])("parses %p as %p", (value, expected) => {
    expect(parseInStock(value)).toBe(expected);
  });

  it.each([null, undefined, "", "yes", "1", 1, {}, []])(
    "returns undefined for %p",
    (value) => {
      expect(parseInStock(value)).toBeUndefined();
    },
  );
});

describe("messages", () => {
  it("uses the documented error messages", () => {
    expect(PRODUCT_FILTER_MESSAGE).toBe("Invalid id");
    expect(ITEM_STATE_FILTER_MESSAGE).toBe("Invalid id");
    expect(IN_STOCK_MESSAGE).toBe("in_stock must be a boolean");
  });
});
