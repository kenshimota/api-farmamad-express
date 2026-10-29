const { methodPaymentRepository } = require("./repository");
const { validateDetails } = require("./details");
const {
  immutablePaymentType,
  invalidDetails,
  invalidPaymentType,
} = require("./errors");

/**
 * Tells whether a payment type can be used: it must exist, be active and its
 * inherited currency must be active too.
 * @param {object|null} type - Loaded type with its currency.
 * @returns {boolean} True when the type can be used.
 */
function isUsableType(type) {
  return Boolean(
    type &&
    type.is_active === true &&
    type.currency &&
    type.currency.is_active === true,
  );
}

/**
 * Throws the documented 422 error when a loaded type cannot be used.
 * @param {object|null} type - Loaded type with its currency.
 * @returns {object} The usable type.
 * @throws {Error} 422 when the type is missing, inactive or its currency is
 *   inactive.
 */
function assertUsableType(type) {
  if (!isUsableType(type)) {
    throw invalidPaymentType();
  }

  return type;
}

/**
 * Validates `details` against the type fields and throws the field errors.
 * @param {object[]|undefined} fields - Type field definitions.
 * @param {unknown} details - Raw details object.
 * @returns {object} The normalized details.
 * @throws {Error} 422 carrying the field-prefixed errors.
 */
function normalizeDetailsOrThrow(fields, details) {
  const validated = validateDetails(fields, details);

  if (Object.keys(validated.errors).length > 0) {
    throw invalidDetails(validated.errors);
  }

  return validated.details;
}

/**
 * Enforces the immutable payment type of an existing method.
 * @param {object} method - Loaded method.
 * @param {object} values - Validated update attributes.
 * @returns {void}
 * @throws {Error} 422 when `method_payment_type_id` changes.
 */
function assertTypeUnchanged(method, values) {
  if (
    values.method_payment_type_id !== undefined &&
    Number(values.method_payment_type_id) !==
      Number(method.method_payment_type_id)
  ) {
    throw immutablePaymentType();
  }
}

/**
 * Builds the update payload with only the fields present in the request.
 * @param {object} values - Validated update attributes.
 * @param {object} details - Normalized details, when provided.
 * @returns {object} The attributes to persist.
 */
function buildUpdates(values, details) {
  const updates = {};

  if (values.label !== undefined) {
    updates.label = values.label;
  }

  if (values.details !== undefined) {
    updates.details = details;
  }

  if (values.is_active !== undefined) {
    updates.is_active = values.is_active;
  }

  return updates;
}

/**
 * Creates the method payments service. Every business rule lives here so the
 * routers only parse, authorize and serialize. The repository is injectable
 * for unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Method payment repository.
 * @returns {object} The method payments service.
 */
function createMethodPaymentService({
  repository = methodPaymentRepository,
} = {}) {
  return {
    /**
     * Lists methods ordered by type and label.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The methods.
     */
    listMethodPayments(filters) {
      return repository.list(filters);
    },

    /**
     * Loads one method with its type and currency.
     * @param {number} id - Method payment id.
     * @returns {Promise<object|null>} The method or null.
     */
    getMethodPayment(id) {
      return repository.findById(id);
    },

    /**
     * Creates a method inside a transaction, validating that the type and its
     * currency are active and that `details` matches the type fields.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The created method with its relations.
     * @throws {Error} 422 for an invalid type or details.
     */
    async createMethodPayment(values) {
      return repository.transaction(async (transaction) => {
        const type = assertUsableType(
          await repository.findType(values.method_payment_type_id, {
            transaction,
          }),
        );

        return repository.create(
          {
            method_payment_type_id: values.method_payment_type_id,
            label: values.label,
            details: normalizeDetailsOrThrow(type.fields, values.details),
            is_active: values.is_active ?? true,
          },
          { transaction },
        );
      });
    },

    /**
     * Updates label, details and is_active inside a transaction. The payment
     * type is immutable; reactivating requires both the type and its currency
     * to be active.
     * @param {object} method - Loaded method.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated method with its relations.
     * @throws {Error} 422 when the type changes, is invalid or details fail.
     */
    async updateMethodPayment(method, values) {
      assertTypeUnchanged(method, values);

      return repository.transaction(async (transaction) => {
        const type = await repository.findType(method.method_payment_type_id, {
          transaction,
        });

        if (!type) {
          throw invalidPaymentType();
        }

        if (values.is_active === true) {
          assertUsableType(type);
        }

        const details =
          values.details === undefined
            ? undefined
            : normalizeDetailsOrThrow(type.fields, values.details);

        await repository.update(method, buildUpdates(values, details), {
          transaction,
        });

        return repository.findById(method.id, { transaction });
      });
    },

    /**
     * Permanently deletes a method payment.
     * @param {object} method - Loaded method.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    deleteMethodPayment(method) {
      return repository.remove(method);
    },
  };
}

const methodPaymentService = createMethodPaymentService();

module.exports = {
  createMethodPaymentService,
  isUsableType,
  methodPaymentService,
};
