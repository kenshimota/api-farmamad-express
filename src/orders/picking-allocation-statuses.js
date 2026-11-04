const ALLOCATION_STATUSES = Object.freeze(["reserved", "consumed", "released"]);
const DEFAULT_ALLOCATION_STATUSES = Object.freeze(["reserved", "consumed"]);
const ALLOCATION_STATUS_FILTERS = Object.freeze([
  ...ALLOCATION_STATUSES,
  "all",
]);

/**
 * Resolves the `?allocation_status=` filter into the statuses the query must
 * include. Without a filter only the active allocations are returned.
 * @param {string} [filter] - Reserved, consumed, released or all.
 * @returns {string[]} The allocation statuses to include.
 */
function resolveAllocationStatuses(filter) {
  if (filter === undefined) {
    return [...DEFAULT_ALLOCATION_STATUSES];
  }

  if (filter === "all") {
    return [...ALLOCATION_STATUSES];
  }

  return [filter];
}

/**
 * Validates the optional allocation status filter accepted by the endpoint.
 * @param {unknown} value - Raw query value.
 * @returns {string|undefined|null} The filter, undefined when absent or null
 *   when invalid.
 */
function parseAllocationStatus(value) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "string" && ALLOCATION_STATUS_FILTERS.includes(value)
    ? value
    : null;
}

module.exports = {
  ALLOCATION_STATUSES,
  ALLOCATION_STATUS_FILTERS,
  DEFAULT_ALLOCATION_STATUSES,
  parseAllocationStatus,
  resolveAllocationStatuses,
};
