const sequelize = require("../database");
const CustomerSeller = require("../models/customer-seller");
const Customer = require("../models/customer");
const User = require("../models/user");
const Role = require("../models/role");
const { buildIncludes } = require("./relations");

const LIST_ORDER = Object.freeze([["customer_id", "ASC"]]);
const CUSTOMER_SELLER_INCLUDES = Object.freeze(
  buildIncludes({ customer: Customer, seller: User }),
);

/**
 * Creates a repository that encapsulates every persistence call of the
 * customer-sellers module. Models and the connection are injectable to keep the
 * abstraction testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - CustomerSeller model.
 * @param {object} [options.customerModel] - Customer model.
 * @param {object} [options.sellerModel] - User model.
 * @param {object} [options.roleModel] - Role model used by the seller include.
 * @param {object} [options.connection] - Sequelize connection.
 * @returns {object} Customer seller repository.
 */
function createCustomerSellerRepository({
  model = CustomerSeller,
  customerModel = Customer,
  sellerModel = User,
  roleModel = Role,
  connection = sequelize,
} = {}) {
  const sellerRoleInclude = Object.freeze([
    { model: roleModel, as: "role", attributes: ["name"] },
  ]);

  return {
    /**
     * Runs a callback inside a database transaction.
     * @param {(transaction: object) => Promise<unknown>} callback - Work.
     * @returns {Promise<unknown>} The callback result.
     */
    transaction(callback) {
      return connection.transaction(callback);
    },

    /**
     * Persists a new assignment.
     * @param {object} values - Assignment attributes.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The created instance.
     */
    create(values, options = {}) {
      return model.create(values, options);
    },

    /**
     * Finds an assignment by primary key including the customer and seller.
     * @param {number} id - Assignment id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The instance or null.
     */
    findById(id, options = {}) {
      return model.findByPk(id, {
        ...options,
        include: CUSTOMER_SELLER_INCLUDES,
      });
    },

    /**
     * Finds the assignment of one customer.
     * @param {number} customerId - Customer id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The instance or null.
     */
    findByCustomerId(customerId, options = {}) {
      return model.findOne({
        where: { customer_id: customerId },
        ...options,
      });
    },

    /**
     * Lists assignments ordered by customer_id, applying the optional filters
     * and eager-loading both relations to avoid N+1 queries.
     * @param {object} [filters] - Listing filters.
     * @param {number} [filters.customerId] - Customer id.
     * @param {number} [filters.sellerId] - Seller id.
     * @returns {Promise<object[]>} The matching instances.
     */
    list({ customerId, sellerId } = {}) {
      const where = {};

      if (customerId !== undefined) {
        where.customer_id = customerId;
      }

      if (sellerId !== undefined) {
        where.seller_id = sellerId;
      }

      return model.findAll({
        where,
        order: LIST_ORDER,
        include: CUSTOMER_SELLER_INCLUDES,
      });
    },

    /**
     * Persists changes on an existing assignment.
     * @param {object} assignment - Loaded instance.
     * @param {object} values - Attributes to update.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object>} The updated instance.
     */
    update(assignment, values, options = {}) {
      return assignment.update(values, options);
    },

    /**
     * Removes an existing assignment.
     * @param {object} assignment - Loaded instance.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(assignment, options = {}) {
      return assignment.destroy(options);
    },

    /**
     * Loads a customer to validate its existence.
     * @param {number} id - Customer id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The customer or null.
     */
    findCustomer(id, options = {}) {
      return customerModel.findByPk(id, options);
    },

    /**
     * Loads a user with its role to validate that it can be a seller.
     * @param {number} id - User id.
     * @param {object} [options] - Sequelize options with the transaction.
     * @returns {Promise<object|null>} The user or null.
     */
    findSeller(id, options = {}) {
      return sellerModel.findByPk(id, {
        ...options,
        include: sellerRoleInclude,
      });
    },
  };
}

const customerSellerRepository = createCustomerSellerRepository();

module.exports = {
  CUSTOMER_SELLER_INCLUDES,
  LIST_ORDER,
  createCustomerSellerRepository,
  customerSellerRepository,
};
