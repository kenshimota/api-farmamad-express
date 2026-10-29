/**
 * Reads a field from a Sequelize instance or a plain object.
 * @param {object} record - Sequelize instance or plain object.
 * @param {string} field - Field name.
 * @returns {unknown} The raw value.
 */
function readField(record, field) {
  return typeof record.get === "function" ? record.get(field) : record[field];
}

/**
 * Converts a DECIMAL rate (usually a string) into a JSON number with at most
 * six decimals. Invalid values become null.
 * @param {unknown} value - Raw DECIMAL value.
 * @returns {number|null} The numeric rate or null.
 */
function toRateNumber(value) {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return null;
  }

  return Number(numeric.toFixed(6));
}

/**
 * Builds the public representation of a currency with no audit columns.
 * @param {object} currency - Currency instance or plain object.
 * @returns {{ id: number, code: string, name: string, symbol: string,
 *   rate: number|null, is_base: boolean, is_active: boolean }} Public data.
 */
function toPublicCurrency(currency) {
  return {
    id: readField(currency, "id"),
    code: readField(currency, "code"),
    name: readField(currency, "name"),
    symbol: readField(currency, "symbol"),
    rate: toRateNumber(readField(currency, "rate")),
    is_base: readField(currency, "is_base") === true,
    is_active: readField(currency, "is_active") === true,
  };
}

/**
 * Builds the nested user that made a rate change.
 * @param {object|null} user - User instance, plain object or null.
 * @returns {{ id: number, username: string, email: string }|null} Public user.
 */
function toPublicChangedBy(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    id: readField(user, "id"),
    username: readField(user, "username"),
    email: readField(user, "email"),
  };
}

/**
 * Serializes `changed_at` as an ISO string, keeping an already stringified
 * value untouched.
 * @param {unknown} value - Date, string or null.
 * @returns {string|null} The timestamp.
 */
function toChangedAt(value) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : value;
}

/**
 * Builds the public representation of one rate history row.
 * @param {object} entry - History instance or plain object.
 * @returns {{ id: number, currency_id: number, previous_rate: number|null,
 *   new_rate: number|null, changed_by: object|null, changed_at: string|null,
 *   reason: string|null }} Public history data.
 */
function toPublicHistoryEntry(entry) {
  const changedByUser = readField(entry, "changed_by_user");
  const changedBy = changedByUser ?? readField(entry, "changed_by");

  return {
    id: readField(entry, "id"),
    currency_id: readField(entry, "currency_id"),
    previous_rate: toRateNumber(readField(entry, "previous_rate")),
    new_rate: toRateNumber(readField(entry, "new_rate")),
    changed_by: toPublicChangedBy(changedBy),
    changed_at: toChangedAt(readField(entry, "changed_at")),
    reason: readField(entry, "reason"),
  };
}

module.exports = {
  toPublicChangedBy,
  toPublicCurrency,
  toPublicHistoryEntry,
  toRateNumber,
};
