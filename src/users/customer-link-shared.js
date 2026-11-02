const { UniqueConstraintError } = require("sequelize");

const CUSTOMER_LINKED_MESSAGE = "Customer is already linked to a user";

/**
 * Tells whether a Sequelize error comes from the unique index that allows one
 * account per customer.
 * @param {unknown} error - Error thrown by Sequelize.
 * @returns {boolean} True when the customer was already linked.
 */
function isCustomerLinkUniqueError(error) {
  if (!(error instanceof UniqueConstraintError)) {
    return false;
  }

  return Boolean(error.fields && error.fields.customer_id);
}

/**
 * Attaches an already loaded customer to a user instance (or plain object) so
 * the serializer can build the response without another query.
 * @param {object} user - User instance or plain object.
 * @param {object|null} customer - Customer to attach.
 * @returns {object} The same user with the customer relation.
 */
function attachCustomer(user, customer) {
  if (user && typeof user.setDataValue === "function") {
    user.setDataValue("customer", customer);
  } else if (user) {
    user.customer = customer;
  }

  return user;
}

module.exports = {
  CUSTOMER_LINKED_MESSAGE,
  attachCustomer,
  isCustomerLinkUniqueError,
};
