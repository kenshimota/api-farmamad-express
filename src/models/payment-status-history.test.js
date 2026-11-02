const PaymentStatusHistory = require("./payment-status-history");
const PaymentStatus = require("./payment-status");
const User = require("./user");

describe("PaymentStatusHistory model", () => {
  it("uses the append-only history table with every audit attribute", () => {
    const attributes = PaymentStatusHistory.getAttributes();

    expect(PaymentStatusHistory.tableName).toBe("payment_status_history");
    expect(attributes.payment_id.allowNull).toBe(false);
    expect(attributes.from_status.allowNull).toBe(true);
    expect(attributes.to_status.allowNull).toBe(false);
    expect(attributes.reason.type.toString()).toBe("VARCHAR(500)");
    expect(attributes.actor_user_id.allowNull).toBe(false);
    expect(attributes.metadata.type.toString()).toBe("JSONB");
  });

  it("references the status catalog and the actor user", () => {
    expect(PaymentStatusHistory.associations.from_status_detail.target).toBe(
      PaymentStatus,
    );
    expect(
      PaymentStatusHistory.associations.from_status_detail.foreignKey,
    ).toBe("from_status");
    expect(PaymentStatusHistory.associations.to_status_detail.target).toBe(
      PaymentStatus,
    );
    expect(PaymentStatusHistory.associations.to_status_detail.foreignKey).toBe(
      "to_status",
    );
    expect(PaymentStatusHistory.associations.actor.target).toBe(User);
    expect(PaymentStatusHistory.associations.actor.foreignKey).toBe(
      "actor_user_id",
    );
  });
});
