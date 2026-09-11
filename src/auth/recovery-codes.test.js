jest.mock("../database", () => ({ transaction: jest.fn() }));
jest.mock("../models/password-reset-code", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
}));

const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sequelize = require("../database");
const PasswordResetCode = require("../models/password-reset-code");
const clock = require("./clock");
const {
  CODE_LENGTH,
  CODE_TTL_MINUTES,
  RESEND_COOLDOWN_MINUTES,
  ISSUE_STATUS,
  CONSUME_STATUS,
  generateCode,
  invalidateCodes,
  issueCode,
  consumeCode,
} = require("./recovery-codes");

const NOW = new Date("2026-01-01T00:00:00.000Z");
const TRANSACTION = { LOCK: { UPDATE: "UPDATE" } };
const CODE = "00427193";

beforeEach(() => {
  clock.setClock(() => NOW);
  sequelize.transaction.mockImplementation((callback) => callback(TRANSACTION));
  PasswordResetCode.create.mockResolvedValue({});
  PasswordResetCode.update.mockResolvedValue([0]);
});

afterEach(() => {
  clock.resetClock();
  jest.restoreAllMocks();
});

describe("recovery code configuration", () => {
  it("exposes the documented constants", () => {
    expect(CODE_LENGTH).toBe(8);
    expect(CODE_TTL_MINUTES).toBe(5);
    expect(RESEND_COOLDOWN_MINUTES).toBe(2);
  });
});

describe("generateCode", () => {
  it("pads the random number to 8 digits with leading zeros", () => {
    jest.spyOn(crypto, "randomInt").mockReturnValue(427193);

    expect(generateCode()).toBe("00427193");
    expect(crypto.randomInt).toHaveBeenCalledWith(0, 100000000);
  });

  it("always returns a string of exactly 8 numeric digits", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(generateCode()).toMatch(/^\d{8}$/);
    }
  });
});

describe("invalidateCodes", () => {
  it("marks every pending code of the user as consumed", async () => {
    await invalidateCodes(7, { transaction: TRANSACTION });

    expect(PasswordResetCode.update).toHaveBeenCalledWith(
      { consumedAt: NOW },
      { where: { userId: 7, consumedAt: null }, transaction: TRANSACTION },
    );
  });

  it("defaults to the clock when no options are given", async () => {
    await invalidateCodes(7);

    expect(PasswordResetCode.update).toHaveBeenCalledWith(
      { consumedAt: NOW },
      { where: { userId: 7, consumedAt: null }, transaction: undefined },
    );
  });
});

describe("issueCode", () => {
  it("invalidates previous codes and persists a hashed code inside a transaction", async () => {
    PasswordResetCode.findOne.mockResolvedValue(null);

    const result = await issueCode(1);

    expect(result.status).toBe(ISSUE_STATUS.ISSUED);
    expect(result.code).toMatch(/^\d{8}$/);
    expect(sequelize.transaction).toHaveBeenCalledTimes(1);
    expect(PasswordResetCode.findOne).toHaveBeenCalledWith({
      where: { userId: 1 },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      lock: TRANSACTION.LOCK.UPDATE,
      transaction: TRANSACTION,
    });
    expect(PasswordResetCode.update).toHaveBeenCalledWith(
      { consumedAt: NOW },
      { where: { userId: 1, consumedAt: null }, transaction: TRANSACTION },
    );

    const [values, options] = PasswordResetCode.create.mock.calls[0];
    expect(values.userId).toBe(1);
    expect(values.expiresAt).toEqual(new Date(NOW.getTime() + 5 * 60 * 1000));
    expect(options).toEqual({ transaction: TRANSACTION });
    expect(values.codeHash).not.toBe(result.code);
    await expect(bcrypt.compare(result.code, values.codeHash)).resolves.toBe(
      true,
    );
  });

  it("sends the plain code through the injected callback", async () => {
    PasswordResetCode.findOne.mockResolvedValue(null);
    const sendCode = jest.fn().mockResolvedValue(undefined);

    const result = await issueCode(1, { sendCode });

    expect(sendCode).toHaveBeenCalledWith(result.code);
  });

  it("responds cooldown without persisting or sending a new code", async () => {
    PasswordResetCode.findOne.mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 60 * 1000),
    });
    const sendCode = jest.fn();

    const result = await issueCode(1, { sendCode });

    expect(result.status).toBe(ISSUE_STATUS.COOLDOWN);
    expect(PasswordResetCode.create).not.toHaveBeenCalled();
    expect(PasswordResetCode.update).not.toHaveBeenCalled();
    expect(sendCode).not.toHaveBeenCalled();
  });

  it("issues a new code once the cooldown has elapsed", async () => {
    PasswordResetCode.findOne.mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 2 * 60 * 1000 - 1),
    });

    const result = await issueCode(1);

    expect(result.status).toBe(ISSUE_STATUS.ISSUED);
    expect(PasswordResetCode.create).toHaveBeenCalledTimes(1);
  });

  it("issues a new code when exactly the cooldown has elapsed", async () => {
    PasswordResetCode.findOne.mockResolvedValue({
      createdAt: new Date(NOW.getTime() - 2 * 60 * 1000),
    });

    const result = await issueCode(1);

    expect(result.status).toBe(ISSUE_STATUS.ISSUED);
  });
});

describe("consumeCode", () => {
  /**
   * Builds a stored code record with a real bcrypt hash.
   * @param {object} [overrides] - Record overrides.
   * @returns {object} The fake Sequelize instance.
   */
  function storedCode(overrides = {}) {
    return {
      id: 1,
      userId: 1,
      codeHash: bcrypt.hashSync(CODE, 10),
      expiresAt: new Date(NOW.getTime() + 60 * 1000),
      consumedAt: null,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it("responds invalid when there is no pending code", async () => {
    PasswordResetCode.findOne.mockResolvedValue(null);

    const result = await consumeCode(1, CODE);

    expect(result.status).toBe(CONSUME_STATUS.INVALID);
  });

  it("responds invalid and keeps the code pending when it is expired", async () => {
    const record = storedCode({ expiresAt: new Date(NOW.getTime() - 1) });
    PasswordResetCode.findOne.mockResolvedValue(record);

    const result = await consumeCode(1, CODE);

    expect(result.status).toBe(CONSUME_STATUS.INVALID);
    expect(record.save).not.toHaveBeenCalled();
  });

  it("responds invalid when the code expires exactly now", async () => {
    const record = storedCode({ expiresAt: NOW });
    PasswordResetCode.findOne.mockResolvedValue(record);

    const result = await consumeCode(1, CODE);

    expect(result.status).toBe(CONSUME_STATUS.INVALID);
    expect(record.save).not.toHaveBeenCalled();
  });

  it("responds invalid without consuming the code when it does not match", async () => {
    const record = storedCode();
    PasswordResetCode.findOne.mockResolvedValue(record);

    const result = await consumeCode(1, "99999999");

    expect(result.status).toBe(CONSUME_STATUS.INVALID);
    expect(record.save).not.toHaveBeenCalled();
  });

  it("marks a matching code as consumed inside the transaction", async () => {
    const record = storedCode();
    PasswordResetCode.findOne.mockResolvedValue(record);

    const result = await consumeCode(1, CODE);

    expect(result.status).toBe(CONSUME_STATUS.VALID);
    expect(record.consumedAt).toBe(NOW);
    expect(record.save).toHaveBeenCalledWith({ transaction: TRANSACTION });
    expect(PasswordResetCode.findOne).toHaveBeenCalledWith({
      where: { userId: 1, consumedAt: null },
      order: [
        ["createdAt", "DESC"],
        ["id", "DESC"],
      ],
      lock: TRANSACTION.LOCK.UPDATE,
      transaction: TRANSACTION,
    });
  });
});
