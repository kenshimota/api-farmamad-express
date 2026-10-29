const { methodPaymentTypeRepository } = require("./repository");
const { invalidCurrency, methodPaymentTypeHasMethods } = require("./errors");
const {
  EDITABLE_FIELDS,
  planUpdate,
  sameFieldsDefinition,
  stableStringify,
} = require("./update-policy");

/**
 * Creates the method payment types service. Every business rule lives here so
 * the routers only parse, authorize and serialize. The repository is injectable
 * for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Method payment type repository.
 * @returns {object} The method payment types service.
 */
function createMethodPaymentTypeService({
  repository = methodPaymentTypeRepository,
} = {}) {
  return {
    /**
     * Lists types ordered by code.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.currencyId] - Exact currency id.
     * @param {boolean} [filters.isActive] - Exact active status.
     * @returns {Promise<object[]>} The types.
     */
    listMethodPaymentTypes(filters) {
      return repository.list(filters);
    },

    /**
     * Loads one type.
     * @param {number} id - Type id.
     * @returns {Promise<object|null>} The type or null.
     */
    getMethodPaymentType(id) {
      return repository.findById(id);
    },

    /**
     * Creates a type with a normalized uppercase code, validating that the
     * currency exists and is active.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The created type.
     * @throws {Error} 422 when the currency is missing or inactive.
     */
    async createMethodPaymentType(values) {
      const currency = await repository.findActiveCurrency(values.currency_id);

      if (!currency) {
        throw invalidCurrency();
      }

      return repository.create({
        code: String(values.code).toUpperCase(),
        name: values.name,
        currency_id: values.currency_id,
        fields: Array.isArray(values.fields) ? values.fields : [],
        description: values.description ?? null,
        is_active: values.is_active ?? true,
      });
    },

    /**
     * Updates the editable fields. `code` is ignored. `currency_id` and
     * `fields` can only change when the type has no concrete methods; sending
     * their current values is allowed and produces no write for them.
     * @param {object} type - Loaded type.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated type.
     * @throws {Error} 409 when the type has methods and a protected value
     *   changes, or 422 when the new currency is missing or inactive.
     */
    async updateMethodPaymentType(type, values) {
      const methodCount = await repository.countMethods(type.id);
      const plan = planUpdate({
        type,
        values,
        hasMethods: methodCount > 0,
      });

      if (plan.conflict) {
        throw methodPaymentTypeHasMethods();
      }

      if (plan.checkCurrency) {
        const currency = await repository.findActiveCurrency(
          values.currency_id,
        );

        if (!currency) {
          throw invalidCurrency();
        }
      }

      return repository.update(type, plan.updates);
    },

    /**
     * Permanently deletes a type that has no concrete methods.
     * @param {object} type - Loaded type.
     * @returns {Promise<void>} Resolves once the row is deleted.
     * @throws {Error} 409 when the type has methods.
     */
    async deleteMethodPaymentType(type) {
      const methodCount = await repository.countMethods(type.id);

      if (methodCount > 0) {
        throw methodPaymentTypeHasMethods();
      }

      return repository.remove(type);
    },
  };
}

const methodPaymentTypeService = createMethodPaymentTypeService();

module.exports = {
  EDITABLE_FIELDS,
  createMethodPaymentTypeService,
  methodPaymentTypeService,
  sameFieldsDefinition,
  stableStringify,
};
