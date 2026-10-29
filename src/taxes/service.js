const { taxRepository } = require("./repository");
const { UPDATE_TAX_FIELDS } = require("./fields");

/**
 * Copies the fields present in the validated body, ignoring the absent ones so
 * a partial update never overwrites a stored value with `undefined`.
 * @param {object} source - Validated update attributes.
 * @param {string[]} fields - Field names accepted by the operation.
 * @returns {object} The attributes that must be persisted.
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
 * Creates the taxes service. Every rule lives here so the routers only parse,
 * authorize and serialize. The repository is injectable for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Tax repository.
 * @returns {object} The taxes service.
 */
function createTaxService({ repository = taxRepository } = {}) {
  return {
    /**
     * Lists taxes ordered by code.
     * @param {object} [options] - Listing options.
     * @param {boolean} [options.isActive] - Filter by active status.
     * @returns {Promise<object[]>} The taxes.
     */
    listTaxes(options) {
      return repository.list(options);
    },

    /**
     * Loads one tax.
     * @param {number} id - Tax id.
     * @returns {Promise<object|null>} The tax or null.
     */
    getTax(id) {
      return repository.findById(id);
    },

    /**
     * Creates a tax with a normalized uppercase code and the documented
     * defaults.
     * @param {object} values - Validated tax attributes.
     * @returns {Promise<object>} The created tax.
     */
    createTax(values) {
      return repository.create({
        code: String(values.code).toUpperCase(),
        name: values.name,
        rate: values.rate,
        description: values.description ?? null,
        is_active: values.is_active ?? true,
      });
    },

    /**
     * Updates the editable fields. The code is immutable and any value sent
     * for it is ignored.
     * @param {object} tax - Loaded tax.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated tax.
     */
    updateTax(tax, values) {
      return repository.update(tax, pickDefined(values, UPDATE_TAX_FIELDS));
    },

    /**
     * Permanently deletes a tax.
     * @param {object} tax - Loaded tax.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    deleteTax(tax) {
      return repository.remove(tax);
    },
  };
}

const taxService = createTaxService();

module.exports = {
  createTaxService,
  EDITABLE_FIELDS: UPDATE_TAX_FIELDS,
  taxService,
};
