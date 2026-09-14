const {
  loginSchema,
  registerAdminSchema,
  forgotPasswordSchema,
  verifyResetCodeSchema,
  resetPasswordSchema,
  formatValidationErrors,
  formatLoginErrors,
  missingFields,
  requiredFieldsMessage,
} = require("./validators");

const PASSWORD_ERROR = "Password must be at least 8 characters long";
const CODE_ERROR = "El código debe tener 8 dígitos";

describe("missingFields", () => {
  it("returns an empty list when no fields are requested", () => {
    expect(missingFields({ email: "juan@example.com" })).toEqual([]);
  });

  it("flags undefined, null and empty string values", () => {
    const body = { a: undefined, b: null, c: "", d: "value", e: 0, f: false };

    expect(missingFields(body, ["a", "b", "c", "d", "e", "f"])).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});

describe("requiredFieldsMessage", () => {
  it("names a single required field", () => {
    expect(requiredFieldsMessage(["email"])).toBe("email is required");
  });

  it("joins two required fields with 'and'", () => {
    expect(requiredFieldsMessage(["email", "code"])).toBe(
      "email and code are required",
    );
  });

  it("joins three or more fields with commas and 'and'", () => {
    expect(requiredFieldsMessage(["email", "code", "password"])).toBe(
      "email, code and password are required",
    );
  });
});

describe("formatValidationErrors", () => {
  it("maps every validation issue to its field", () => {
    const error = {
      inner: [
        { path: "email", message: "Email inválido" },
        { path: "code", message: CODE_ERROR },
      ],
    };

    expect(formatValidationErrors(error)).toEqual({
      email: "Email inválido",
      code: CODE_ERROR,
    });
  });

  it("keeps the first message when a field has several issues", () => {
    const error = {
      inner: [
        { path: "email", message: "first" },
        { path: "email", message: "second" },
      ],
    };

    expect(formatValidationErrors(error)).toEqual({ email: "first" });
  });

  it("falls back to the error itself when there are no inner issues", () => {
    expect(
      formatValidationErrors({ path: "email", message: "Email inválido" }),
    ).toEqual({ email: "Email inválido" });
  });
});

describe("formatLoginErrors", () => {
  const identifierError = {
    inner: [{ path: "identifier", message: "Invalid email" }],
  };

  it("reports the identifier as email when it contains @", () => {
    expect(formatLoginErrors(identifierError, "juan@example.com")).toEqual({
      email: "Invalid email",
    });
  });

  it("keeps the identifier when it does not look like an email", () => {
    expect(formatLoginErrors(identifierError, "juan")).toEqual({
      identifier: "Invalid email",
    });
  });

  it("keeps the identifier when it is not a string", () => {
    expect(formatLoginErrors(identifierError, 123)).toEqual({
      identifier: "Invalid email",
    });
  });

  it("does not add an email error when the identifier is valid", () => {
    const error = { inner: [{ path: "password", message: "too short" }] };

    expect(formatLoginErrors(error, "juan@example.com")).toStrictEqual({
      password: "too short",
    });
  });
});

describe("forgotPasswordSchema", () => {
  it("accepts and trims a valid email", async () => {
    await expect(
      forgotPasswordSchema.validate({ email: "  juan@example.com  " }),
    ).resolves.toEqual({ email: "juan@example.com" });
  });

  it("rejects an invalid email with the Spanish message", async () => {
    await expect(
      forgotPasswordSchema.validate({ email: "invalid@" }),
    ).rejects.toThrow("Email inválido");
  });
});

describe("verifyResetCodeSchema", () => {
  it("accepts exactly 8 digits", async () => {
    await expect(
      verifyResetCodeSchema.validate({
        email: "juan@example.com",
        code: "00427193",
      }),
    ).resolves.toEqual({ email: "juan@example.com", code: "00427193" });
  });

  it("rejects codes that are not exactly 8 digits", async () => {
    for (const code of ["1234567", "123456789", "1234567a", "abcdefgh"]) {
      await expect(
        verifyResetCodeSchema.validate({ email: "juan@example.com", code }),
      ).rejects.toThrow(CODE_ERROR);
    }
  });

  it("rejects a code that is not a string", async () => {
    await expect(
      verifyResetCodeSchema.validate({ email: "juan@example.com", code: {} }),
    ).rejects.toThrow(CODE_ERROR);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts matching passwords", async () => {
    await expect(
      resetPasswordSchema.validate({
        password: "nuevaClave123",
        passwordConfirmation: "nuevaClave123",
      }),
    ).resolves.toEqual({
      password: "nuevaClave123",
      passwordConfirmation: "nuevaClave123",
    });
  });

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      resetPasswordSchema.validate({
        password: "short",
        passwordConfirmation: "short",
      }),
    ).rejects.toThrow(PASSWORD_ERROR);
  });

  it("rejects a confirmation that does not match", async () => {
    await expect(
      resetPasswordSchema.validate({
        password: "nuevaClave123",
        passwordConfirmation: "otraClave123",
      }),
    ).rejects.toThrow("Passwords do not match");
  });

  it("rejects a non-string confirmation with the match message", async () => {
    await expect(
      resetPasswordSchema.validate({
        password: "nuevaClave123",
        passwordConfirmation: {},
      }),
    ).rejects.toThrow("Passwords do not match");
  });
});

describe("loginSchema", () => {
  it("trims the identifier and keeps a valid password", async () => {
    await expect(
      loginSchema.validate({
        identifier: "  juan@example.com  ",
        password: "secret123",
      }),
    ).resolves.toEqual({
      identifier: "juan@example.com",
      password: "secret123",
    });
  });

  it("accepts a username without @", async () => {
    await expect(
      loginSchema.validate({ identifier: "juan", password: "secret123" }),
    ).resolves.toEqual({ identifier: "juan", password: "secret123" });
  });

  it("rejects an identifier that looks like a malformed email", async () => {
    await expect(
      loginSchema.validate({ identifier: "invalid@", password: "secret123" }),
    ).rejects.toThrow("Invalid email");
  });

  it("rejects a password that is not a string", async () => {
    await expect(
      loginSchema.validate({ identifier: "juan", password: {} }),
    ).rejects.toThrow(PASSWORD_ERROR);
  });
});

describe("registerAdminSchema", () => {
  it("trims username, email and name", async () => {
    await expect(
      registerAdminSchema.validate({
        username: "  juan  ",
        email: "  juan@example.com  ",
        password: "secret123",
        name: "  Juan  ",
      }),
    ).resolves.toEqual({
      username: "juan",
      email: "juan@example.com",
      password: "secret123",
      name: "Juan",
    });
  });

  it("rejects an invalid email", async () => {
    await expect(
      registerAdminSchema.validate({
        username: "juan",
        email: "invalid@",
        password: "secret123",
      }),
    ).rejects.toThrow("Invalid email");
  });

  it("accepts a missing name", async () => {
    await expect(
      registerAdminSchema.validate({
        username: "juan",
        email: "juan@example.com",
        password: "secret123",
      }),
    ).resolves.toEqual({
      username: "juan",
      email: "juan@example.com",
      password: "secret123",
    });
  });
});
