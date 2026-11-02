const { readField } = require("../shared/serializer");
const { CUSTOMER_ROLE, ORDER_STATUSES } = require("./constants");
const { forbidden, invalidStatusTransition } = require("./errors");

/**
 * Decides which side effect a valid forward transition must run.
 * @param {string} target - Destination status code.
 * @returns {string} `request`, `generate`, `invoice`, `cancel` or `forward`.
 */
function sideEffectOf(target) {
  if (target === ORDER_STATUSES.REQUEST) {
    return "request";
  }

  if (target === ORDER_STATUSES.GENERATE) {
    return "generate";
  }

  if (target === ORDER_STATUSES.INVOICED) {
    return "invoice";
  }

  if (target === ORDER_STATUSES.CANCELLED) {
    return "cancel";
  }

  return "forward";
}

/**
 * Validates a transition against the documented role matrix and forward chain.
 * @param {object} params - Transition inputs.
 * @param {string} params.current - Current status code.
 * @param {object} params.currentStatus - Current status definition.
 * @param {string} params.target - Destination status code.
 * @param {object} params.context - Actor context.
 * @returns {{ kind: string, source: string }} The side effect to run.
 */
function assertTransition({ current, currentStatus, target, context }) {
  if (current === target) {
    throw invalidStatusTransition();
  }

  const next = readField(currentStatus, "next_status_code") ?? null;

  if (context.role === CUSTOMER_ROLE) {
    if (target === ORDER_STATUSES.CANCELLED) {
      if (
        current !== ORDER_STATUSES.DRAFT &&
        current !== ORDER_STATUSES.REQUEST
      ) {
        throw forbidden();
      }

      return { kind: "cancel", source: current };
    }

    if (target === ORDER_STATUSES.REQUEST) {
      if (current !== ORDER_STATUSES.DRAFT || next !== ORDER_STATUSES.REQUEST) {
        throw invalidStatusTransition();
      }

      return { kind: "request", source: current };
    }

    throw forbidden();
  }

  if (target === ORDER_STATUSES.CANCELLED) {
    if (current === ORDER_STATUSES.INVOICED) {
      throw invalidStatusTransition();
    }

    return { kind: "cancel", source: current };
  }

  if (target === ORDER_STATUSES.REQUEST) {
    // Requesting is reserved to the owning customer.
    throw forbidden();
  }

  if (current === ORDER_STATUSES.DRAFT && target === ORDER_STATUSES.GENERATE) {
    return { kind: "generate", source: current };
  }

  if (next !== target) {
    throw invalidStatusTransition();
  }

  return { kind: sideEffectOf(target), source: current };
}

module.exports = { assertTransition, sideEffectOf };
