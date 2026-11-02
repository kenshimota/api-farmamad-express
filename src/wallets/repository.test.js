const {
  TRANSACTION_ORDER,
  WALLET_ORDER,
  createWalletRepository,
} = require("./repository");

/**
 * Builds the model doubles and the repository around them.
 * @returns {object} The repository and doubles.
 */
function buildRepository() {
  const walletModel = {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue({ id: 5 }),
  };
  const transactionModel = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  return {
    transactionModel,
    walletModel,
    repository: createWalletRepository({
      walletModel,
      transactionModel,
      userModel: {},
    }),
  };
}

describe("wallet repository", () => {
  it("lists the wallets of a customer with their currency", async () => {
    const { repository, walletModel } = buildRepository();

    await repository.findByCustomer(8);

    expect(WALLET_ORDER).toEqual([["currency_id", "ASC"]]);
    expect(walletModel.findAll).toHaveBeenCalledWith({
      where: { customer_id: 8 },
      order: WALLET_ORDER,
      include: [expect.objectContaining({ as: "currency" })],
    });
  });

  it("finds one wallet by id with its currency", async () => {
    const { repository, walletModel } = buildRepository();

    await expect(repository.findById(5)).resolves.toEqual({ id: 5 });
    expect(walletModel.findByPk).toHaveBeenCalledWith(5, {
      include: [expect.objectContaining({ as: "currency" })],
    });
  });

  it("lists movements newest first without created_by by default", async () => {
    const { repository, transactionModel } = buildRepository();

    await repository.listTransactions(5);

    expect(TRANSACTION_ORDER).toEqual([
      ["createdAt", "DESC"],
      ["id", "DESC"],
    ]);
    expect(transactionModel.findAll).toHaveBeenCalledWith({
      where: { wallet_id: 5 },
      order: TRANSACTION_ORDER,
      include: [expect.objectContaining({ as: "wallet" })],
    });
  });

  it("adds the created_by include for staff", async () => {
    const { repository, transactionModel } = buildRepository();

    await repository.listTransactions(5, { includeCreatedBy: true });

    const include = transactionModel.findAll.mock.calls[0][0].include;
    expect(include).toHaveLength(2);
    expect(include[1]).toMatchObject({ as: "created_by" });
  });
});
