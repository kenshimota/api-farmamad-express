const Order = require("../models/order");
const { buildPickingQuery } = require("./picking-includes");
const {
  ALLOCATION_STATUSES,
  DEFAULT_ALLOCATION_STATUSES,
  resolveAllocationStatuses,
} = require("./picking-allocation-statuses");

/**
 * Creates the read-only repository of the picking view. The order and every
 * relation are loaded with one eager-loaded query built by `picking-includes`.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Order model.
 * @returns {object} The picking repository.
 */
function createPickingRepository({ model = Order } = {}) {
  return {
    /**
     * Loads one order with the picking view relations.
     * @param {number} id - Order id.
     * @param {object} [options] - Query options.
     * @param {string} [options.allocationStatus] - Allocation status filter.
     * @returns {Promise<object|null>} The loaded order or null.
     */
    findOrderById(id, { allocationStatus } = {}) {
      return model.findByPk(
        id,
        buildPickingQuery(resolveAllocationStatuses(allocationStatus)),
      );
    },
  };
}

const pickingRepository = createPickingRepository();

module.exports = {
  ALLOCATION_STATUSES,
  DEFAULT_ALLOCATION_STATUSES,
  createPickingRepository,
  pickingRepository,
  resolveAllocationStatuses,
};
