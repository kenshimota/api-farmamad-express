const { readField } = require("../shared/serializer");
const { orderStatusRepository } = require("./repository");
const { BASE_STATUS_CODES } = require("./constants");
const {
  alreadyExists,
  configurationIncomplete,
  invalidNextStatus,
  notFound,
  sameNextStatus,
  statusCycle,
  statusInUse,
  systemStatusNotDeletable,
} = require("./errors");

/**
 * Creates the order-statuses service. Every business rule of the catalog lives
 * here so the router only parses, authorizes and serializes.
 * @param {object} [dependencies] - Injectable dependencies.
 * @param {object} [dependencies.repository] - Order status repository.
 * @returns {object} The order statuses service.
 */
function createOrderStatusService({ repository = orderStatusRepository } = {}) {
  /**
   * Validates the destination of a `next_status_code` link: it must exist, it
   * cannot point to the same status and it cannot close a cycle.
   * @param {string} code - Code of the status being created or updated.
   * @param {string|null} nextCode - Requested destination.
   * @returns {Promise<void>}
   * @throws {Error} 422 for an invalid, self-referencing or cyclic link.
   */
  async function assertValidNextStatus(code, nextCode) {
    if (nextCode === null || nextCode === undefined) {
      return;
    }

    if (nextCode === code) {
      throw sameNextStatus();
    }

    const destination = await repository.findByCode(nextCode);

    if (!destination) {
      throw invalidNextStatus();
    }

    const visited = new Set();
    let current = readField(destination, "next_status_code");

    while (current !== null && current !== undefined) {
      if (current === code || visited.has(current)) {
        throw statusCycle();
      }

      visited.add(current);
      const status = await repository.findByCode(current);

      if (!status) {
        return;
      }

      current = readField(status, "next_status_code");
    }
  }

  /**
   * Loads a status or throws the documented 404.
   * @param {number} id - Status id.
   * @returns {Promise<object>} The stored status.
   * @throws {Error} 404 when it does not exist.
   */
  async function getStatus(id) {
    const status = await repository.findById(id);

    if (!status) {
      throw notFound();
    }

    return status;
  }

  return {
    /**
     * Lists the catalog ordered by `sort_order` and `id` ascending.
     * @returns {Promise<object[]>} The statuses.
     */
    list() {
      return repository.findAll();
    },

    get: getStatus,

    /**
     * Creates an additional, non-system status.
     * @param {object} input - Validated status attributes.
     * @returns {Promise<object>} The created status.
     */
    async create(input) {
      const existing = await repository.findByCode(input.code);

      if (existing) {
        throw alreadyExists();
      }

      await assertValidNextStatus(input.code, input.next_status_code ?? null);

      return repository.create({
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        sort_order: input.sort_order,
        next_status_code: input.next_status_code ?? null,
        is_system: false,
      });
    },

    /**
     * Updates the mutable fields of a status. `code` and `is_system` are
     * immutable; sending them has no effect.
     * @param {number} id - Status id.
     * @param {object} input - Validated attributes.
     * @returns {Promise<object>} The updated status.
     */
    async update(id, input) {
      const status = await getStatus(id);
      const values = {};

      if (Object.prototype.hasOwnProperty.call(input, "name")) {
        values.name = input.name;
      }

      if (Object.prototype.hasOwnProperty.call(input, "description")) {
        values.description = input.description ?? null;
      }

      if (Object.prototype.hasOwnProperty.call(input, "sort_order")) {
        values.sort_order = input.sort_order;
      }

      if (Object.prototype.hasOwnProperty.call(input, "next_status_code")) {
        const nextCode = input.next_status_code ?? null;

        await assertValidNextStatus(readField(status, "code"), nextCode);
        values.next_status_code = nextCode;
      }

      await status.update(values);

      return status;
    },

    /**
     * Deletes an additional status that is not referenced anywhere.
     * @param {number} id - Status id.
     * @returns {Promise<void>}
     * @throws {Error} 404 when missing, 409 for system or in-use statuses.
     */
    async remove(id) {
      const status = await getStatus(id);

      if (readField(status, "is_system")) {
        throw systemStatusNotDeletable();
      }

      const inUse = await repository.isInUse(id, readField(status, "code"));

      if (inUse) {
        throw statusInUse();
      }

      await repository.remove(status);
    },

    /**
     * Ensures the five base statuses exist.
     * @returns {Promise<void>}
     * @throws {Error} 503 when the configuration is incomplete.
     */
    async assertComplete() {
      const existing = await repository.countCodes(BASE_STATUS_CODES);

      if (Number(existing) !== BASE_STATUS_CODES.length) {
        throw configurationIncomplete();
      }
    },
  };
}

const orderStatusService = createOrderStatusService();

module.exports = {
  createOrderStatusService,
  orderStatusService,
};
