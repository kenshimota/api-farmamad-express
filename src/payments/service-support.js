const {
  immutableField,
  invalidMethodPayment,
  methodPaymentNotFound,
} = require("./errors");
const { toCents } = require("./money");

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
 * Deletes an image row and its files when no other payment still references
 * it. Every failure is ignored so the already committed payment deletion is not
 * reported as failed.
 * @param {object} repository - Payment repository.
 * @param {object} image - Loaded image row.
 * @param {function(object): Promise<void>} imageCleaner - File cleanup.
 * @returns {Promise<void>} Resolves once the cleanup was attempted.
 */
async function removeImageBestEffort(repository, image, imageCleaner) {
  try {
    if ((await repository.countImageReferences(image.id)) > 0) {
      return;
    }

    await repository.removeImage(image);
    await imageCleaner(image);
  } catch (error) {
    // Best-effort cleanup: the payment is already gone.
  }
}

module.exports = {
  assertImmutable,
  assertUsableMethod,
  buildUpdates,
  isUsableMethod,
  removeImageBestEffort,
  toCents,
};
