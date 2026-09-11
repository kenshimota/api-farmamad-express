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
});
