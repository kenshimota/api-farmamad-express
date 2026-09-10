const bcrypt = require("bcrypt");
const User = require("./user");

describe("User model", () => {
  it("defines username, email and password as required unique fields", () => {
    const attributes = User.getAttributes();

    expect(attributes.username.allowNull).toBe(false);
    expect(attributes.username.unique).toBe(true);
    expect(attributes.email.allowNull).toBe(false);
    expect(attributes.email.unique).toBe(true);
    expect(attributes.email.validate.isEmail).toBe(true);
    expect(attributes.password.allowNull).toBe(false);
    expect(attributes.name.allowNull).toBe(true);
  });

  it("hashes the password before creating a user", async () => {
    const beforeCreate = User.options.hooks.beforeCreate[0];
    const instance = User.build({
      username: "juan",
      email: "juan@example.com",
      password: "secret123",
    });

    await beforeCreate(instance);

    expect(instance.password).not.toBe("secret123");
    expect(bcrypt.getRounds(instance.password)).toBe(10);
    await expect(bcrypt.compare("secret123", instance.password)).resolves.toBe(
      true,
    );
  });

  it("hashes the password before updating it", async () => {
    const beforeUpdate = User.options.hooks.beforeUpdate[0];
    const instance = User.build({
      username: "juan",
      email: "juan@example.com",
      password: "new-secret",
    });

    await beforeUpdate(instance);

    expect(instance.password).not.toBe("new-secret");
    await expect(bcrypt.compare("new-secret", instance.password)).resolves.toBe(
      true,
    );
  });

  it("keeps the stored password when it was not changed", async () => {
    const beforeUpdate = User.options.hooks.beforeUpdate[0];
    const instance = User.build({
      username: "juan",
      email: "juan@example.com",
    });

    await beforeUpdate(instance);

    expect(instance.password).toBeUndefined();
  });

  it("never exposes the password through toJSON", () => {
    const instance = User.build({
      username: "juan",
      email: "juan@example.com",
      password: "hash",
    });

    expect(instance.toJSON()).not.toHaveProperty("password");
    expect(instance.toJSON()).toEqual(
      expect.objectContaining({
        username: "juan",
        email: "juan@example.com",
      }),
    );
  });
});
