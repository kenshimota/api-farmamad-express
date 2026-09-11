const clock = require("./clock");

const FIXED = new Date("2026-01-01T00:00:00.000Z");

afterEach(() => {
  clock.resetClock();
});

describe("clock", () => {
  it("returns the current date by default", () => {
    const before = Date.now();
    const value = clock.now();

    expect(value).toBeInstanceOf(Date);
    expect(value.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("uses the injected provider until it is reset", () => {
    clock.setClock(() => FIXED);

    expect(clock.now()).toBe(FIXED);

    clock.resetClock();
    expect(clock.now()).not.toBe(FIXED);
  });
});
