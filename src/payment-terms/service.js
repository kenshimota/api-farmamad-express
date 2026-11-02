const { paymentTermRepository } = require("./repository");
const { UPDATE_PAYMENT_TERM_FIELDS } = require("./fields");
const { paymentTermInUse } = require("./errors");

/**
 * Copies the fields present in the validated body, ignoring absent ones so a
 * partial update never overwrites a stored value with `undefined`.
 * @param {object} source - Validated update attributes.
 * @param {string[]} fields - Accepted field names.
 * @returns {object} The attributes to persist.
 */
function pickDefined(source, fields) {
  return fields.reduce((picked, field) => {
    if (source[field] !== undefined) {
      picked[field] = source[field];
    }

    return picked;
  }, {});
}

/**
 * Creates the payment-terms service. Every rule lives here so routers only
 * parse, authorize and serialize. The repository is injectable.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Payment term repository.
 * @returns {object} The payment-terms service.
 */
function createPaymentTermService({ repository = paymentTermRepository } = {}) {
  return {
    /**
     * Lists terms ordered by days and id ascending.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.isActive] - Filter by active status.
     * @returns {Promise<object[]>} The matching terms.
     */
    listPaymentTerms(options) {
      return repository.list(options);
    },

    /**
     * Loads one term.
     * @param {number} id - Payment term id.
     * @returns {Promise<object|null>} The term or null.
     */
    getPaymentTerm(id) {
      return repository.findById(id);
    },

    /**
     * Creates a term with a normalized lowercase code and documented defaults.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The created term.
     */
    createPaymentTerm(values) {
      return repository.create({
        code: String(values.code).toLowerCase(),
        name: values.name,
        description: values.description ?? null,
        days: values.days,
        is_active: values.is_active ?? true,
      });
    },

    /**
     * Updates the editable fields. The code is immutable.
     * @param {object} term - Loaded term.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated term.
     */
    updatePaymentTerm(term, values) {
      return repository.update(
        term,
        pickDefined(values, UPDATE_PAYMENT_TERM_FIELDS),
      );
    },

    /**
     * Deletes a term unless a customer, order or invoice references it.
     * @param {object} term - Loaded term.
     * @returns {Promise<void>} Resolves once the row is deleted.
     * @throws {Error} 409 when the term is in use.
     */
    async deletePaymentTerm(term) {
      if (await repository.isInUse(term.id)) {
        throw paymentTermInUse();
      }

      return repository.remove(term);
    },
  };
}

const paymentTermService = createPaymentTermService();

module.exports = {
  createPaymentTermService,
  pickDefined,
  paymentTermService,
};
