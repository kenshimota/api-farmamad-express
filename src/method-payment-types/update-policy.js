const { IMMUTABLE_WITH_METHODS_FIELDS } = require("./fields");

/**
 * Fields an administrator can always change, even when the type already has
 * concrete payment methods.
 */
const EDITABLE_FIELDS = Object.freeze(["name", "description", "is_active"]);

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
 * Serializes a JSON value with sorted object keys so two equivalent fields
 * definitions compare equal even when their properties are ordered differently.
 * @param {unknown} value - JSON value.
 * @returns {string} Stable representation.
 */
function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);

    return `{${entries.join(",")}}`;
  }

  return JSON.stringify(value);
}

/**
 * Tells whether two fields definitions are equivalent.
 * @param {unknown} left - First definition.
 * @param {unknown} right - Second definition.
 * @returns {boolean} True when both have the same content.
 */
function sameFieldsDefinition(left, right) {
  return stableStringify(left) === stableStringify(right);
}

/**
 * Comparison strategy per protected field. A field is only protected when the
 * value actually changes, so sending the stored value is always allowed.
 */
const PROTECTED_FIELD_COMPARATORS = Object.freeze({
  currency_id: (requested, stored) => Number(requested) !== Number(stored),
  fields: (requested, stored) => !sameFieldsDefinition(requested, stored),
});

/**
 * Returns the protected fields whose requested value differs from the stored
 * one. The list comes from the shared field contract so a new protected field
 * only needs its comparator registered here.
 * @param {object} type - Loaded type.
 * @param {object} values - Validated update attributes.
 * @returns {string[]} Names of the protected fields that change.
 */
function changedProtectedFields(type, values) {
  return IMMUTABLE_WITH_METHODS_FIELDS.filter((field) => {
    if (values[field] === undefined) {
      return false;
    }

    return PROTECTED_FIELD_COMPARATORS[field](values[field], type[field]);
  });
}

/**
 * Decides which attributes an update must persist and whether the new currency
 * still needs the active-currency check. Keeping the decision pure simplifies
 * the service, which only performs the resulting queries.
 * @param {object} options - Update context.
 * @param {object} options.type - Loaded type.
 * @param {object} options.values - Validated update attributes.
 * @param {boolean} options.hasMethods - Whether the type already has methods.
 * @returns {{ conflict: boolean, checkCurrency: boolean, updates: object }}
 *   The update plan.
 */
function planUpdate({ type, values, hasMethods }) {
  const changed = changedProtectedFields(type, values);

  if (hasMethods && changed.length > 0) {
    return { conflict: true, checkCurrency: false, updates: {} };
  }

  const updates = pickDefined(values, EDITABLE_FIELDS);

  if (!hasMethods) {
    if (values.currency_id !== undefined) {
      updates.currency_id = values.currency_id;
    }

    if (values.fields !== undefined) {
      updates.fields = values.fields;
    }
  }

  return {
    conflict: false,
    checkCurrency: !hasMethods && changed.includes("currency_id"),
    updates,
  };
}

module.exports = {
  EDITABLE_FIELDS,
  changedProtectedFields,
  pickDefined,
  planUpdate,
  sameFieldsDefinition,
  stableStringify,
};
