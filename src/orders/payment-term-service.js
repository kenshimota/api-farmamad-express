const { readField } = require("../shared/serializer");
const { assertAssignablePaymentTerm } = require("../payment-terms/assignment");
const { EDITABLE_STATUSES, INTERNAL_ROLES } = require("./constants");
const { forbidden, orderNotFound, orderNotEditable } = require("./errors");

/**
 * Creates the payment-term service of editable orders.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Orders repository.
 * @param {object} dependencies.access - Access helpers.
 * @param {Function} [dependencies.assertTerm] - Payment term validator.
 * @returns {object} The payment term service.
 */
function createOrderPaymentTermService({
  repository,
  access,
  assertTerm = assertAssignablePaymentTerm,
}) {
  return {
    /**
     * Replaces the payment term snapshot of a draft or requested order.
     * @param {number} orderId - Order id.
     * @param {object} input - Validated body with `payment_term_id`.
     * @param {object} actor - JWT payload.
     * @returns {Promise<object>} The updated order.
     */
    async updatePaymentTerm(orderId, input, actor) {
      const context = await access.resolveContext(actor);

      if (!INTERNAL_ROLES.includes(context.role)) {
        throw forbidden();
      }

      return repository.transaction(async (transaction) => {
        const order = await repository.findById(orderId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!order) {
          throw orderNotFound();
        }

        await access.assertEditAccess(order, context);

        if (!EDITABLE_STATUSES.includes(readField(order, "status"))) {
          throw orderNotEditable();
        }

        const term = await assertTerm(input.payment_term_id);

        await repository.updatePaymentTerm(order, readField(term, "id"), {
          transaction,
        });

        return repository.findById(orderId, { transaction });
      });
    },
  };
}

module.exports = { createOrderPaymentTermService };
