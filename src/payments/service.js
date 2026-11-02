const { paymentRepository } = require("./repository");
const { IMMUTABLE_PAYMENT_FIELDS } = require("./fields");
const {
  customerNotFound,
  depositNotFound,
  immutableField,
  invalidMethodPayment,
  methodPaymentNotFound,
  paymentHasAllocations,
  walletBalanceWouldBeNegative,
} = require("./errors");

/**
 * Rounds a money value to two decimals.
 * @param {unknown} value - Raw decimal value.
 * @returns {number} The rounded number.
 */
function toCents(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Tells whether a payment method can receive money: the method, its type and
 * the inherited currency must all be active.
 * @param {object|null} method - Method with its type and currency.
 * @returns {boolean} True when the method is usable.
 */
function isUsableMethod(method) {
  return Boolean(
    method &&
    method.is_active === true &&
    method.method_payment_type &&
    method.method_payment_type.is_active === true &&
    method.method_payment_type.currency &&
    method.method_payment_type.currency.is_active === true,
  );
}

/**
 * Throws the documented 404/422 errors when the method cannot be used.
 * @param {object|null} method - Loaded method.
 * @returns {object} The usable method.
 * @throws {Error} 404 when missing and 422 when inactive or unusable.
 */
function assertUsableMethod(method) {
  if (!method) {
    throw methodPaymentNotFound();
  }

  if (!isUsableMethod(method)) {
    throw invalidMethodPayment();
  }

  return method;
}

/**
 * Compares an immutable payment field with the persisted value.
 * @param {object} payment - Loaded payment.
 * @param {object} values - Validated update attributes.
 * @param {string} field - Field name.
 * @returns {void}
 * @throws {Error} 422 when the value changes.
 */
function assertImmutable(payment, values, field) {
  if (values[field] === undefined) {
    return;
  }

  const current = Number(payment[field]);
  const next = Number(values[field]);

  if (current !== next) {
    throw immutableField(field);
  }
}

/**
 * Builds the metadata updates of a payment, normalizing empty text to null.
 * @param {object} values - Validated update attributes.
 * @returns {object} The attributes to persist.
 */
function buildUpdates(values) {
  const updates = {};

  if (values.reference !== undefined) {
    updates.reference = values.reference;
  }

  if (values.notes !== undefined) {
    updates.notes = values.notes;
  }

  if (values.paid_at !== undefined) {
    updates.paid_at = values.paid_at;
  }

  return updates;
}

/**
 * Creates the payments service. All business rules and the atomic wallet
 * updates live here so routers only parse, authorize and serialize.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Payment repository.
 * @returns {object} The payments service.
 */
function createPaymentService({ repository = paymentRepository } = {}) {
  return {
    /**
     * Lists payments with the optional filters.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The payments.
     */
    listPayments(filters) {
      return repository.list(filters);
    },

    /**
     * Loads one payment with its method and currency.
     * @param {number} id - Payment id.
     * @returns {Promise<object|null>} The payment or null.
     */
    getPayment(id) {
      return repository.findById(id);
    },

    /**
     * Registers a received payment and credits the customer wallet inside one
     * transaction. The wallet is created on the first deposit.
     * @param {object} values - Validated attributes.
     * @param {number} userId - Authenticated user id.
     * @returns {Promise<{ payment: object, wallet: object }>} The created
     *   payment and the credited wallet.
     * @throws {Error} 404/422 for an invalid customer or method.
     */
    async createPayment(values, userId) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };
        const customer = await repository.findCustomer(values.customer_id, {
          transaction,
        });

        if (!customer) {
          throw customerNotFound();
        }

        const method = assertUsableMethod(
          await repository.findMethod(values.method_payment_id, {
            transaction,
          }),
        );
        const currencyId = method.method_payment_type.currency_id;
        const wallet = await repository.findOrCreateWallet(
          customer.id,
          currencyId,
          options,
        );
        const amount = toCents(values.amount);

        const creditedWallet = await repository.incrementBalance(
          wallet,
          amount,
          options,
        );
        const balanceAfter = toCents(creditedWallet.balance);
        const payment = await repository.create(
          {
            customer_id: customer.id,
            method_payment_id: method.id,
            currency_id: currencyId,
            amount,
            paid_at: values.paid_at ?? new Date(),
            reference: values.reference ?? null,
            notes: values.notes ?? null,
            created_by_user_id: userId,
          },
          options,
        );

        await repository.createWalletTransaction(
          {
            wallet_id: wallet.id,
            transaction_type: "deposit",
            amount,
            balance_after: balanceAfter,
            payment_id: payment.id,
            invoice_id: null,
            payment_allocation_id: null,
            description: values.notes ?? values.reference ?? null,
            created_by_user_id: userId,
          },
          options,
        );

        return { payment, wallet: creditedWallet };
      });
    },

    /**
     * Updates the metadata of a payment. Amount, customer, method and currency
     * are immutable and a payment with invoice allocations cannot be edited.
     * @param {object} payment - Loaded payment.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated payment.
     * @throws {Error} 409/422 when the payment has allocations or an immutable
     *   field changes.
     */
    async updatePayment(payment, values) {
      return repository.transaction(async (transaction) => {
        if (
          (await repository.countAllocations(payment.id, { transaction })) > 0
        ) {
          throw paymentHasAllocations();
        }

        for (const field of IMMUTABLE_PAYMENT_FIELDS) {
          assertImmutable(payment, values, field);
        }

        const updates = buildUpdates(values);

        if (Object.keys(updates).length > 0) {
          await repository.update(payment, updates, { transaction });
        }

        return repository.findById(payment.id, { transaction });
      });
    },

    /**
     * Deletes a payment only when it has no invoice allocations, reverting the
     * deposit and refusing to leave a negative wallet balance.
     * @param {object} payment - Loaded payment.
     * @returns {Promise<void>} Resolves once the payment is deleted.
     * @throws {Error} 409 when the payment has allocations, has no deposit or
     *   would leave a negative balance.
     */
    async deletePayment(payment) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };

        if (
          (await repository.countAllocations(payment.id, { transaction })) > 0
        ) {
          throw paymentHasAllocations();
        }

        const deposit = await repository.findDeposit(payment.id, options);

        if (!deposit) {
          throw depositNotFound();
        }

        const wallet = await repository.findWalletForUpdate(
          deposit.wallet_id,
          options,
        );
        const amount = toCents(payment.amount);
        const balanceAfter = toCents(Number(wallet.balance) - amount);

        if (balanceAfter < 0) {
          throw walletBalanceWouldBeNegative();
        }

        await repository.incrementBalance(wallet, -amount, options);
        await repository.removeWalletTransaction(deposit, options);
        await repository.remove(payment, options);
      });
    },
  };
}

const paymentService = createPaymentService();

module.exports = {
  createPaymentService,
  isUsableMethod,
  paymentService,
  toCents,
};
