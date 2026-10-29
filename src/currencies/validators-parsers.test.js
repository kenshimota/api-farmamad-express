const {
  INCLUDE_INACTIVE_MESSAGE,
  REQUIRED_CURRENCY_FIELDS,
  UPDATE_CURRENCY_FIELDS,
} = require("./validators");
const { parseBooleanFlag, parseCurrencyId } = require("./parsers");

describe("constants", () => {
  it("lists the required and editable fields", () => {
    expect(REQUIRED_CURRENCY_FIELDS).toEqual([
      "code",
      "name",
      "symbol",
      "rate",
    ]);
    expect(UPDATE_CURRENCY_FIELDS).toEqual([
      "name",
      "symbol",
      "rate",
      "is_active",
      "reason",
    ]);
  });

  it("exposes the documented include_inactive message", () => {
    expect(INCLUDE_INACTIVE_MESSAGE).toBe("Invalid include_inactive");
  });
});

describe("parseCurrencyId", () => {
  it.each([
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["", null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses %p as %p", (value, expected) => {
    expect(parseCurrencyId(value)).toBe(expected);
  });
});

describe("parseBooleanFlag", () => {
  it.each([
    [true, true],
    [false, false],
    ["true", true],
    [" TRUE ", true],
    ["false", false],
    [" FALSE ", false],
    ["yes", undefined],
    ["", undefined],
    [1, undefined],
    [null, undefined],
    [undefined, undefined],
  ])("parses %p as %p", (value, expected) => {
    expect(parseBooleanFlag(value)).toBe(expected);
  });
});
