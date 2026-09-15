const {
  createUserSchema,
  updateUserStatusSchema,
  parseUserId,
  REQUIRED_USER_FIELDS,
} = require("./validators");

describe("parseUserId", () => {
  it("parses positive integer strings and numbers", () => {
    expect(parseUserId("1")).toBe(1);
    expect(parseUserId("42")).toBe(42);
    expect(parseUserId(" 7 ")).toBe(7);
    expect(parseUserId(3)).toBe(3);
  });

  it.each([
    ["zero", "0"],
    ["a negative number", "-1"],
    ["a decimal", "1.5"],
    ["a non numeric string", "abc"],
    ["an empty string", ""],
    ["a blank string", "   "],
    ["scientific notation", "1e2"],
    ["hexadecimal notation", "0x10"],
    ["null", null],
    ["undefined", undefined],
    ["an object", {}],
    ["a boolean", true],
    ["NaN", Number.NaN],
  ])("returns null for %s", (_case, value) => {
    expect(parseUserId(value)).toBeNull();
  });
});

describe("updateUserStatusSchema", () => {
  it("accepts boolean true and false", async () => {
    await expect(
      updateUserStatusSchema.validate({ isBlocked: true }),
    ).resolves.toEqual({ isBlocked: true });
    await expect(
      updateUserStatusSchema.validate({ isBlocked: false }),
    ).resolves.toEqual({ isBlocked: false });
  });

  it.each([["true"], ["yes"], [1], [0], [{}], [[]]])(
    "rejects %p with the exact message",
    async (value) => {
      await expect(
        updateUserStatusSchema.validate({ isBlocked: value }),
      ).rejects.toThrow("isBlocked must be a boolean");
    },
  );
});

describe("createUserSchema", () => {
  it("does not accept isBlocked from the client", () => {
    expect(createUserSchema.fields).not.toHaveProperty("isBlocked");
  });

  it("keeps the documented required fields", () => {
    expect(REQUIRED_USER_FIELDS).toEqual([
      "username",
      "email",
      "password",
      "role",
    ]);
  });
});
