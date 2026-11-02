const PriceList = require("../models/price-list");
const Customer = require("../models/customer");

const LIST_ORDER = Object.freeze([
  ["name", "ASC"],
  ["id", "ASC"],
]);

/**
 * Creates a repository that encapsulates every persistence call for the
 * price-lists module. The models are injectable to keep the abstraction
 * testable.
 * @param {object} [options] - Injectable dependencies.
 * @param {object} [options.model] - Price list model.
 * @param {object} [options.customerModel] - Customer model used to detect
 *   whether a list is assigned.
 * @returns {object} Price list repository.
 */
function createPriceListRepository({
  model = PriceList,
  customerModel = Customer,
} = {}) {
  /**
   * Finds a price list by primary key.
   * @param {number} id - Positive integer id.
   * @returns {Promise<object|null>} The instance or null.
   */
  function findById(id) {
    return model.findByPk(id);
  }

  return {
    /**
     * Persists a new price list.
     * @param {object} values - Validated price list attributes.
     * @returns {Promise<object>} The created instance.
     */
    create(values) {
      return model.create(values);
    },

    /**
     * Lists every price list ordered by name and id.
     * @returns {Promise<object[]>} The stored instances.
     */
    list() {
      return model.findAll({ order: LIST_ORDER });
    },

    findById,

    /**
     * Persists the full replacement of an existing list.
     * @param {object} priceList - Loaded instance.
     * @param {object} values - Validated attributes.
     * @returns {Promise<object>} The updated instance.
     */
    async update(priceList, values) {
      await priceList.update(values);

      return findById(priceList.id);
    },

    /**
     * Permanently removes an existing instance.
     * @param {object} priceList - Loaded instance.
     * @returns {Promise<void>} Resolves once the row is deleted.
     */
    remove(priceList) {
      return priceList.destroy();
    },

    /**
     * Counts the customers assigned to a price list.
     * @param {number} id - Price list id.
     * @returns {Promise<number>} The number of assigned customers.
     */
    countCustomers(id) {
      return customerModel.count({ where: { price_list_id: id } });
    },
  };
}

const priceListRepository = createPriceListRepository();

module.exports = {
  LIST_ORDER,
  createPriceListRepository,
  priceListRepository,
};
