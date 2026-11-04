const MONEY_FORMATTER = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const RATE_FORMATTER = new Intl.NumberFormat("es-VE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});
const DATE_FORMATTER = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Caracas",
});
const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("es-VE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Caracas",
});
const PAYMENT_STATUS_LABELS = Object.freeze({
  pending: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
});
const SUPPORTED_TEXT = /[^\n\r\t\x20-\x7E\xA0-\xFF€]/gu;

/**
 * Formats a money amount with the Venezuelan separators and the currency
 * symbol (or code when the symbol is missing).
 * @param {unknown} value - Raw amount.
 * @param {object|null} [currency] - Currency summary with `symbol`/`code`.
 * @returns {string} The formatted amount.
 */
function formatMoney(value, currency) {
  const amount = MONEY_FORMATTER.format(Number(value) || 0);
  const label = currency?.symbol || currency?.code || "";

  return label ? `${label} ${amount}` : amount;
}

/**
 * Formats an exchange rate with up to six decimals.
 * @param {unknown} value - Raw rate.
 * @returns {string} The formatted rate.
 */
function formatRate(value) {
  return RATE_FORMATTER.format(Number(value) || 0);
}

/**
 * Converts a date value into a Date instance.
 * @param {unknown} value - Date, ISO string or null.
 * @returns {Date|null} The date or null when invalid.
 */
function toDate(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Formats a date as `DD/MM/YYYY` in Venezuelan Spanish.
 * @param {unknown} value - Date or ISO string.
 * @returns {string} The formatted date or an empty string.
 */
function formatDate(value) {
  const date = toDate(value);

  return date ? DATE_FORMATTER.format(date) : "";
}

/**
 * Formats a date and time as `DD/MM/YYYY HH:mm` in Venezuelan Spanish.
 * @param {unknown} value - Date or ISO string.
 * @returns {string} The formatted date-time or an empty string.
 */
function formatDateTime(value) {
  const date = toDate(value);

  return date ? DATE_TIME_FORMATTER.format(date).replace(", ", " ") : "";
}

/**
 * Replaces characters the standard PDF fonts cannot render with `?` while
 * keeping Spanish letters, line breaks and the usual currency symbols.
 * @param {unknown} value - Raw text.
 * @returns {string} The sanitized text.
 */
function sanitizeText(value) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).replace(SUPPORTED_TEXT, "?");
}

/**
 * Truncates notes to the maximum length stored by the model.
 * @param {unknown} value - Raw notes.
 * @param {number} [maxLength] - Maximum length.
 * @returns {string} The truncated notes.
 */
function truncateNotes(value, maxLength = 1000) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).slice(0, maxLength);
}

/**
 * Translates the invoice payment status into Spanish.
 * @param {unknown} status - Raw status.
 * @returns {string} The label or the original status.
 */
function formatPaymentStatus(status) {
  return PAYMENT_STATUS_LABELS[status] ?? String(status ?? "");
}

module.exports = {
  formatDate,
  formatDateTime,
  formatMoney,
  formatPaymentStatus,
  formatRate,
  sanitizeText,
  truncateNotes,
};
