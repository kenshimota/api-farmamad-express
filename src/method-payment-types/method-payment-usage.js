const METHOD_PAYMENT_MODEL_PATH = "../models/method-payment";

/**
 * Columns that HU-29 may use to reference a method payment type. The future
 * model decides the name; only these documented candidates are checked.
 */
const METHOD_PAYMENT_COLUMNS = Object.freeze([
  "method_payment_type_id",
  "type_id",
  "method_payment_type",
]);

/**
 * Tells whether a require failure means that the HU-29 model is not present
 * yet. A missing transitive dependency must keep propagating, so only the exact
 * model path is treated as absence.
 * @param {unknown} error - Error thrown by `require`.
 * @returns {boolean} True when the model module itself is missing.
 */
function isMissingMethodPaymentModel(error) {
  return (
    Boolean(error) &&
    error.code === "MODULE_NOT_FOUND" &&
    typeof error.message === "string" &&
    error.message.includes(METHOD_PAYMENT_MODEL_PATH)
  );
}

/**
 * Loads the future HU-29 `MethodPayment` model only when it exists. HU-28 must
 * keep working before that table and model are added, so a missing module is
 * treated as "no concrete methods yet" instead of crashing.
 * @returns {object|null} The model or null when it is not present.
 * @throws {unknown} Any error unrelated to the missing module.
 */
function loadMethodPaymentModel() {
  try {
    return require(METHOD_PAYMENT_MODEL_PATH);
  } catch (error) {
    if (isMissingMethodPaymentModel(error)) {
      return null;
    }

    throw error;
  }
}

/**
 * Resolves the foreign key column HU-29 uses to reference this type.
 * @param {object} model - MethodPayment model.
 * @returns {string|null} The declared foreign key column or null.
 */
function resolveMethodPaymentColumn(model) {
  const attributes =
    typeof model.getAttributes === "function"
      ? model.getAttributes()
      : model.rawAttributes;

  if (!attributes || typeof attributes !== "object") {
    return null;
  }

  return (
    METHOD_PAYMENT_COLUMNS.find((column) =>
      Object.prototype.hasOwnProperty.call(attributes, column),
    ) ?? null
  );
}

/**
 * Builds the strategy that counts the concrete methods of a type. The loader is
 * injectable so the missing HU-29 model and the known column candidates are
 * easy to test without touching the database.
 * @param {object} [options] - Injectable dependencies.
 * @param {() => object|null} [options.loader] - Loader of the future
 *   MethodPayment model.
 * @returns {{ countMethods: (id: number) => Promise<number> }} Usage counter.
 */
function createMethodPaymentUsage({ loader = loadMethodPaymentModel } = {}) {
  return {
    /**
     * Counts the concrete methods of a type. When HU-29 has not been
     * implemented the model is absent and the count is zero.
     * @param {number} id - Type id.
     * @returns {Promise<number>} The amount of concrete methods.
     */
    countMethods(id) {
      const model = loader();

      if (!model) {
        return Promise.resolve(0);
      }

      const column = resolveMethodPaymentColumn(model);

      if (!column) {
        return Promise.resolve(0);
      }

      return model.count({ where: { [column]: id } });
    },
  };
}

module.exports = {
  METHOD_PAYMENT_COLUMNS,
  METHOD_PAYMENT_MODEL_PATH,
  createMethodPaymentUsage,
  isMissingMethodPaymentModel,
  loadMethodPaymentModel,
  resolveMethodPaymentColumn,
};
