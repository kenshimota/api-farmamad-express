const { toPublicWallet, toPublicWalletTransaction } = require("./serializer");

const CURRENCY = { id: 2, code: "USDT", name: "Tether", symbol: "$" };
const WALLET = {
  id: 5,
  customer_id: 8,
  currency_id: 2,
  currency: CURRENCY,
  balance: "100.00",
};
const TRANSACTION = {
  id: 1,
  transaction_type: "deposit",
  amount: "100.00",
  balance_after: "100.00",
  payment_id: 1,
  invoice_id: null,
  payment_allocation_id: null,
  description: "Depósito",
  createdAt: new Date("2026-11-01T12:00:00.000Z"),
  wallet: { id: 5, currency_id: 2, currency: CURRENCY },
  created_by: { id: 1, username: "maria", email: "maria@farmamad.com" },
};

describe("wallet serializer", () => {
  it("serializes a wallet with its currency", () => {
    expect(toPublicWallet(WALLET)).toEqual({
      id: 5,
      customer_id: 8,
      currency_id: 2,
      currency: CURRENCY,
      balance: 100,
    });
  });

  it("serializes a movement without created_by for the customer", () => {
    const result = toPublicWalletTransaction(TRANSACTION);

    expect(result).toEqual({
      id: 1,
      transaction_type: "deposit",
      amount: 100,
      balance_after: 100,
      currency: CURRENCY,
      payment_id: 1,
      invoice_id: null,
      payment_allocation_id: null,
      description: "Depósito",
      created_at: "2026-11-01T12:00:00.000Z",
    });
    expect(result).not.toHaveProperty("created_by");
  });

  it("includes created_by for staff", () => {
    expect(
      toPublicWalletTransaction(TRANSACTION, { includeCreatedBy: true }),
    ).toMatchObject({
      created_by: { id: 1, username: "maria", email: "maria@farmamad.com" },
    });
  });

  it("keeps missing timestamps and relations as null", () => {
    expect(
      toPublicWalletTransaction(
        { ...TRANSACTION, createdAt: null, wallet: null, created_by: null },
        { includeCreatedBy: true },
      ),
    ).toMatchObject({ created_at: null, currency: null, created_by: null });
  });

  it("keeps a wallet without currency serializable", () => {
    expect(toPublicWallet({ ...WALLET, currency: null })).toMatchObject({
      currency: null,
    });
  });
});
