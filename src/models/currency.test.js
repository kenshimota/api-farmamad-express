const Currency = require("./currency");
const User = require("./user");
const CurrencyRateHistory = require("./currency-rate-history");

describe("Currency model", () => {
  it("defines the documented columns and defaults", () => {
    const attributes = Currency.getAttributes();

    expect(attributes.code.type.toString()).toBe("VARCHAR(10)");
    expect(attributes.code.allowNull).toBe(false);
    expect(attributes.name.type.toString()).toBe("VARCHAR(100)");
    expect(attributes.name.allowNull).toBe(false);
    expect(attributes.symbol.type.toString()).toBe("VARCHAR(10)");
    expect(attributes.symbol.allowNull).toBe(false);
    expect(attributes.rate.type.toString()).toBe("DECIMAL(18,6)");
    expect(attributes.rate.allowNull).toBe(false);
    expect(attributes.is_base.type.key).toBe("BOOLEAN");
    expect(attributes.is_base.allowNull).toBe(false);
    expect(attributes.is_base.defaultValue).toBe(false);
    expect(attributes.is_active.type.key).toBe("BOOLEAN");
    expect(attributes.is_active.allowNull).toBe(false);
    expect(attributes.is_active.defaultValue).toBe(true);
  });

  it("uses the documented model and table names", () => {
    expect(Currency.name).toBe("Currency");
    expect(Currency.tableName).toBe("currencies");
  });

  it("has many rate history rows", () => {
    expect(Currency.associations.rate_history.associationType).toBe("HasMany");
    expect(Currency.associations.rate_history.options.foreignKey).toBe(
      "currency_id",
    );
    expect(Currency.associations.rate_history.options.as).toBe("rate_history");
    expect(Currency.associations.rate_history.target).toBe(CurrencyRateHistory);
  });
});

describe("CurrencyRateHistory model", () => {
  it("defines the documented columns without audit timestamps", () => {
    const attributes = CurrencyRateHistory.getAttributes();

    expect(attributes.currency_id.type.key).toBe("INTEGER");
    expect(attributes.currency_id.allowNull).toBe(false);
    expect(attributes.previous_rate.type.toString()).toBe("DECIMAL(18,6)");
    expect(attributes.previous_rate.allowNull).toBe(true);
    expect(attributes.new_rate.type.toString()).toBe("DECIMAL(18,6)");
    expect(attributes.new_rate.allowNull).toBe(false);
    expect(attributes.changed_by.type.key).toBe("INTEGER");
    expect(attributes.changed_by.allowNull).toBe(true);
    expect(attributes.changed_at.type.key).toBe("DATE");
    expect(attributes.changed_at.allowNull).toBe(false);
    expect(attributes.reason.type.toString()).toBe("VARCHAR(255)");
    expect(attributes.reason.allowNull).toBe(true);
    expect(CurrencyRateHistory.options.timestamps).toBe(false);
    expect(attributes).not.toHaveProperty("createdAt");
    expect(attributes).not.toHaveProperty("updatedAt");
  });

  it("uses the documented model and table names", () => {
    expect(CurrencyRateHistory.name).toBe("CurrencyRateHistory");
    expect(CurrencyRateHistory.tableName).toBe("currency_rate_history");
  });

  it("belongs to Currency and User with the documented aliases", () => {
    expect(CurrencyRateHistory.associations.currency.associationType).toBe(
      "BelongsTo",
    );
    expect(CurrencyRateHistory.associations.currency.options.foreignKey).toBe(
      "currency_id",
    );
    expect(CurrencyRateHistory.associations.currency.options.as).toBe(
      "currency",
    );
    expect(CurrencyRateHistory.associations.currency.target).toBe(Currency);

    expect(
      CurrencyRateHistory.associations.changed_by_user.associationType,
    ).toBe("BelongsTo");
    expect(
      CurrencyRateHistory.associations.changed_by_user.options.foreignKey,
    ).toBe("changed_by");
    expect(CurrencyRateHistory.associations.changed_by_user.options.as).toBe(
      "changed_by_user",
    );
    expect(CurrencyRateHistory.associations.changed_by_user.target).toBe(User);
  });

  it("registers the inverse user association", () => {
    expect(User.associations.currency_rate_changes.associationType).toBe(
      "HasMany",
    );
    expect(User.associations.currency_rate_changes.options.foreignKey).toBe(
      "changed_by",
    );
    expect(User.associations.currency_rate_changes.options.as).toBe(
      "currency_rate_changes",
    );
  });
});
