const { paymentRepository } = require("./repository");
const { IMMUTABLE_PAYMENT_FIELDS } = require("./fields");
const {
  processPaymentImage,
  removePaymentImageFiles,
} = require("./image-service");
const { removeFiles } = require("../shared/image-service");
const {
  customerNotFound,
  depositNotFound,
  paymentHasAllocations,
  walletBalanceWouldBeNegative,
} = require("./errors");
const {
  assertImmutable,
  assertUsableMethod,
  buildUpdates,
  isUsableMethod,
  removeImageBestEffort,
  toCents,
} = require("./service-support");
const { imageAttributes, storeReferenceImage } = require("./reference-image");

const PENDING_STATUS = "pending";
const CONCILIATED_STATUS = "conciliated";

/**
 * Creates the payments service. All business rules and the atomic wallet
 * updates live here so routers only parse, authorize and serialize.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Payment repository.
 * @param {function(object): Promise<object>} [dependencies.imageProcessor] -
 *   Image processor used by create and update.
 * @param {function(string[]): Promise<void>} [dependencies.fileRemover] -
 *   Cleanup used when a transaction rolls back.
 * @param {function(object): Promise<void>} [dependencies.imageCleaner] -
 *   Best-effort file cleanup used after deleting a payment.
 * @returns {object} The payments service.
 */
function createPaymentService({
  repository = paymentRepository,
  imageProcessor = processPaymentImage,
  fileRemover = removeFiles,
  imageCleaner = removePaymentImageFiles,
} = {}) {
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
     * Loads one payment with its method, currency, status, image and history.
     * @param {number} id - Payment id.
     * @returns {Promise<object|null>} The payment or null.
     */
    getPayment(id) {
      return repository.findById(id, {}, { includeHistory: true });
    },

    /**
     * Lists the status history of one payment.
     * @param {number} id - Payment id.
     * @returns {Promise<object[]>} The events with their actor.
     */
    listHistory(id) {
      return repository.listStatusHistory(id);
    },

    /**
     * Registers a payment in `pending` without touching the wallet. An optional
     * image is validated and stored atomically; if anything fails the files are
     * removed and no payment, image or history row remains.
     * @param {object} values - Validated attributes.
     * @param {number} userId - Authenticated user id.
     * @param {object} [options] - Extra request data.
     * @param {object|null} [options.file] - Multer in-memory image.
     * @returns {Promise<{ payment: object, wallet: null }>} The pending payment.
     * @throws {Error} 404/422 for an invalid customer or method.
     */
    async createPayment(values, userId, { file = null } = {}) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };
        let files = [];

        try {
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
          let referenceImageId = null;

          if (file) {
            const stored = await storeReferenceImage(
              repository,
              imageProcessor,
              file,
              options,
            );
            files = stored.files;
            referenceImageId = stored.referenceImageId;
          }

          const payment = await repository.create(
            {
              customer_id: customer.id,
              method_payment_id: method.id,
              currency_id: method.method_payment_type.currency_id,
              amount: toCents(values.amount),
              paid_at: values.paid_at ?? new Date(),
              reference: values.reference ?? null,
              notes: values.notes ?? null,
              status: PENDING_STATUS,
              rejection_reason: null,
              reference_image_id: referenceImageId,
              created_by_user_id: userId,
            },
            options,
          );

          await repository.createStatusHistory(
            {
              payment_id: payment.id,
              from_status: null,
              to_status: PENDING_STATUS,
              reason: null,
              actor_user_id: userId,
              metadata: null,
            },
            options,
          );

          return { payment, wallet: null };
        } catch (error) {
          await fileRemover(files);
          throw error;
        }
      });
    },

    /**
     * Updates the metadata of a payment and optionally replaces its reference
     * image. Amount, customer, method and currency are immutable and a payment
     * with invoice allocations cannot be edited. The previous image row and its
     * files are kept for audit.
     * @param {object} payment - Loaded payment.
     * @param {object} values - Validated update attributes.
     * @param {object} [options] - Extra request data.
     * @param {object|null} [options.file] - Multer in-memory image.
     * @returns {Promise<object>} The updated payment.
     * @throws {Error} 409/422 when the payment has allocations or an immutable
     *   field changes.
     */
    async updatePayment(payment, values, { file = null } = {}) {
      return repository.transaction(async (transaction) => {
        const options = { transaction };
        let files = [];

        try {
          if (
            (await repository.countAllocations(payment.id, { transaction })) > 0
          ) {
            throw paymentHasAllocations();
          }

          for (const field of IMMUTABLE_PAYMENT_FIELDS) {
            assertImmutable(payment, values, field);
          }

          const updates = buildUpdates(values);

          if (file) {
            const stored = await storeReferenceImage(
              repository,
              imageProcessor,
              file,
              options,
            );
            files = stored.files;
            updates.reference_image_id = stored.referenceImageId;
          }

          if (Object.keys(updates).length > 0) {
            await repository.update(payment, updates, options);
          }

          return repository.findById(payment.id, options);
        } catch (error) {
          await fileRemover(files);
          throw error;
        }
      });
    },

    /**
     * Deletes a payment only when it has no invoice allocations. A conciliated
     * payment reverts its deposit and refuses to leave a negative balance; a
     * pending or rejected payment never touches the wallet. Unreferenced
     * reference images are removed after the transaction on a best-effort
     * basis.
     * @param {object} payment - Loaded payment.
     * @returns {Promise<void>} Resolves once the payment is deleted.
     * @throws {Error} 409 when the payment has allocations, has no deposit or
     *   would leave a negative balance.
     */
    async deletePayment(payment) {
      const image = await repository.transaction(async (transaction) => {
        const options = { transaction };

        if (
          (await repository.countAllocations(payment.id, { transaction })) > 0
        ) {
          throw paymentHasAllocations();
        }

        if (payment.status === CONCILIATED_STATUS) {
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
        }

        const referenceImage = payment.reference_image_id
          ? await repository.findImage(payment.reference_image_id, {
              transaction,
            })
          : null;

        await repository.remove(payment, options);

        return referenceImage;
      });

      if (image) {
        await removeImageBestEffort(repository, image, imageCleaner);
      }
    },
  };
}

const paymentService = createPaymentService();

module.exports = {
  CONCILIATED_STATUS,
  PENDING_STATUS,
  createPaymentService,
  imageAttributes,
  isUsableMethod,
  paymentService,
  toCents,
};
