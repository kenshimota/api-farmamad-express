const { customerSellerRepository } = require("./repository");
const {
  customerAlreadyAssigned,
  invalidCustomer,
  invalidSeller,
} = require("./errors");

const SELLER_ROLE = "seller";

/**
 * Validates that a customer exists, throwing the documented 422 error when it
 * does not.
 * @param {object} repository - Customer seller repository.
 * @param {number} customerId - Customer id.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<void>} Resolves when the customer exists.
 * @throws {Error} 422 when the customer does not exist.
 */
async function assertCustomer(repository, customerId, transaction) {
  const customer = await repository.findCustomer(customerId, { transaction });

  if (!customer) {
    throw invalidCustomer();
  }
}

/**
 * Validates that the user exists, has the `seller` role and is not blocked,
 * throwing the documented 422 error otherwise.
 * @param {object} repository - Customer seller repository.
 * @param {number} sellerId - User id.
 * @param {object} transaction - Open transaction.
 * @returns {Promise<void>} Resolves when the user can be a seller.
 * @throws {Error} 422 when the user cannot be a seller.
 */
async function assertSeller(repository, sellerId, transaction) {
  const seller = await repository.findSeller(sellerId, { transaction });

  if (
    !seller ||
    seller.isBlocked === true ||
    !seller.role ||
    seller.role.name !== SELLER_ROLE
  ) {
    throw invalidSeller();
  }
}

/**
 * Creates the customer-sellers service. Every business rule lives here so
 * routers only parse, authorize and serialize. Dependencies are injectable for
 * unit tests.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Customer seller repository.
 * @returns {object} The customer-sellers service.
 */
function createCustomerSellerService({
  repository = customerSellerRepository,
} = {}) {
  /**
   * Template for every write: persist inside one transaction and then reload
   * the row with its relations. The concrete write step is injected so create
   * and update share the same transactional sequence.
   * @param {(transaction: object) => Promise<number>} write - Persists the row
   *   and returns its id.
   * @returns {Promise<object>} The persisted assignment with its relations.
   */
  async function writeAtomically(write) {
    return repository.transaction(async (transaction) => {
      const id = await write(transaction);

      return repository.findById(id, { transaction });
    });
  }

  return {
    /**
     * Lists assignments with the documented filters and order.
     * @param {object} [filters] - Listing filters.
     * @returns {Promise<object[]>} The matching assignments.
     */
    listAssignments(filters) {
      return repository.list(filters);
    },

    /**
     * Loads one assignment with its customer and seller.
     * @param {number} id - Assignment id.
     * @returns {Promise<object|null>} The assignment or null.
     */
    getAssignment(id) {
      return repository.findById(id);
    },

    /**
     * Creates an assignment inside a transaction after validating both
     * references and rejecting a customer that already has a seller. The unique
     * constraint still protects the operation against concurrent requests.
     * @param {object} values - Validated assignment attributes.
     * @returns {Promise<object>} The created assignment with its relations.
     * @throws {Error} 422 for invalid references or seller.
     * @throws {Error} 409 when the customer already has a seller.
     */
    async createAssignment(values) {
      return writeAtomically(async (transaction) => {
        await assertCustomer(repository, values.customer_id, transaction);
        await assertSeller(repository, values.seller_id, transaction);

        const existing = await repository.findByCustomerId(values.customer_id, {
          transaction,
        });

        if (existing) {
          throw customerAlreadyAssigned();
        }

        const created = await repository.create(
          {
            customer_id: values.customer_id,
            seller_id: values.seller_id,
          },
          { transaction },
        );

        return created.id;
      });
    },

    /**
     * Reassigns the seller of an existing assignment and refreshes
     * `assigned_at` inside a transaction.
     * @param {object} assignment - Loaded assignment.
     * @param {object} values - Validated update attributes.
     * @returns {Promise<object>} The updated assignment with its relations.
     * @throws {Error} 422 when the new seller is invalid.
     */
    async updateAssignment(assignment, values) {
      return writeAtomically(async (transaction) => {
        await assertSeller(repository, values.seller_id, transaction);

        await repository.update(
          assignment,
          { seller_id: values.seller_id, assigned_at: new Date() },
          { transaction },
        );

        return assignment.id;
      });
    },

    /**
     * Removes only the assignment; the customer and the seller stay untouched.
     * @param {object} assignment - Loaded assignment.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    deleteAssignment(assignment) {
      return repository.remove(assignment);
    },
  };
}

const customerSellerService = createCustomerSellerService();

module.exports = {
  SELLER_ROLE,
  createCustomerSellerService,
  customerSellerService,
};
