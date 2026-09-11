const User = require("./user");
const PasswordResetCode = require("./password-reset-code");

describe("PasswordResetCode model", () => {
  it("is associated with User in both directions", () => {
    expect(User.associations.passwordResetCodes.associationType).toBe(
      "HasMany",
    );
    expect(PasswordResetCode.associations.user.associationType).toBe(
      "BelongsTo",
    );
  });

  it("uses the documented model and table names", () => {
    expect(PasswordResetCode.name).toBe("PasswordResetCode");
    expect(PasswordResetCode.tableName).toBe("password_reset_codes");
  });

  it("defines the required recovery code columns", () => {
    const attributes = PasswordResetCode.getAttributes();

    expect(attributes.userId.type.key).toBe("INTEGER");
    expect(attributes.userId.allowNull).toBe(false);
    expect(attributes.codeHash.type.key).toBe("STRING");
    expect(attributes.codeHash.allowNull).toBe(false);
    expect(attributes.expiresAt.type.key).toBe("DATE");
    expect(attributes.expiresAt.allowNull).toBe(false);
    expect(attributes.consumedAt.type.key).toBe("DATE");
    expect(attributes.consumedAt.allowNull).toBe(true);
  });

  it("keeps the raw foreign keys and aliases of its associations", () => {
    expect(PasswordResetCode.associations.user.options.foreignKey).toBe(
      "userId",
    );
    expect(PasswordResetCode.associations.user.options.as).toBe("user");
    expect(User.associations.passwordResetCodes.options.foreignKey).toBe(
      "userId",
    );
    expect(User.associations.passwordResetCodes.options.as).toBe(
      "passwordResetCodes",
    );
  });
});
