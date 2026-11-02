/**
 * Stable payment status codes shared by validation, the service layer and the
 * serializers. The database catalog seeds the same three codes.
 */
const PAYMENT_STATUS = Object.freeze({
  PENDING: "pending",
  CONCILIATED: "conciliated",
  REJECTED: "rejected",
});

const PAYMENT_STATUS_CODES = Object.freeze(Object.values(PAYMENT_STATUS));

const PAYMENT_STATUS_NAMES = Object.freeze({
  pending: "Pendiente",
  conciliated: "Conciliado",
  rejected: "Rechazado",
});

/**
 * Transitions allowed by HU-47. Conciliated and rejected are terminal; a
 * rejected payment is corrected by registering a new one.
 */
const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze([PAYMENT_STATUS.CONCILIATED, PAYMENT_STATUS.REJECTED]),
  conciliated: Object.freeze([]),
  rejected: Object.freeze([]),
});

/**
 * Tells whether a transition between two statuses is allowed.
 * @param {string} from - Current status code.
 * @param {string} to - Requested status code.
 * @returns {boolean} True when the transition is allowed.
 */
function canTransition(from, to) {
  return Boolean(
    PAYMENT_STATUS_TRANSITIONS[from] &&
    PAYMENT_STATUS_TRANSITIONS[from].includes(to),
  );
}

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_STATUS_CODES,
  PAYMENT_STATUS_NAMES,
  PAYMENT_STATUS_TRANSITIONS,
  canTransition,
};
