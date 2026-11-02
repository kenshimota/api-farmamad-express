const { readField } = require("../shared/serializer");

/**
 * Builds the public representation of an order status.
 * @param {object} status - Sequelize instance or plain object.
 * @returns {object} Public status data with the derived `is_terminal`.
 */
function toPublicOrderStatus(status) {
  const nextStatusCode = readField(status, "next_status_code");

  return {
    id: readField(status, "id"),
    code: readField(status, "code"),
    name: readField(status, "name"),
    description: readField(status, "description"),
    sort_order: readField(status, "sort_order"),
    next_status_code: nextStatusCode ?? null,
    is_terminal: (nextStatusCode ?? null) === null,
    is_system: Boolean(readField(status, "is_system")),
  };
}

module.exports = { toPublicOrderStatus };
