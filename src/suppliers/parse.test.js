const { parseSupplierId } = require("./validators");

describe("parseSupplierId", () => {
  it.each([
    [1, 1],
    ["2", 2],
    ["  3  ", 3],
    ["0", null],
    ["-1", null],
    ["1.5", null],
    ["abc", null],
    ["", null],
    [0, null],
    [-1, null],
    [1.5, null],
    [null, null],
    [undefined, null],
    [{}, null],
  ])("parses %p as %p", (value, expected) => {
    expect(parseSupplierId(value)).toBe(expected);
  });
});
