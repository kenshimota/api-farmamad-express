const { authorize } = require("../auth/authorize");
const { authenticate } = require("../auth/middleware");
const {
  CUSTOMER_ROLE,
  loadCurrentUser,
  resolveCustomerScope,
} = require("../shared/customer-access");
const {
  createHttpError,
  isHttpError,
  sendHttpError,
} = require("../shared/http-error");
const { readField } = require("../shared/serializer");
const { storeRepository } = require("./repository");
const {
  MISSING_CUSTOMER_ID_MESSAGE,
  parseCustomerId,
} = require("./validators");

const READ_ROLES = Object.freeze(["customer", "admin", "seller"]);
const SELLER_ROLE = "seller";
const CUSTOMER_PRICE_LIST_MESSAGE = "Customer price list is not assigned";
const SELLER_NOT_ASSIGNED_MESSAGE = "Customer is not assigned to this seller";

/**
 * Guards every store endpoint: only customers, administrators and sellers can
 * read the catalog. The current user row is loaded because ownership rules need
 * `users.customer_id`, which is not part of the JWT payload.
 * @returns {import("express").RequestHandler[]} The middleware chain.
 */
function readAccess() {
  return [authenticate, authorize(...READ_ROLES), loadCurrentUser];
}

/**
 * Resolves the customer whose price list is used by the request and enforces
 * every access rule of the contract.
 * @param {object} params - Resolution inputs.
 * @param {object} params.user - Current user instance with its role.
 * @param {unknown} [params.requestedCustomerId] - Raw `customer_id` query value.
 * @param {object} [params.repository] - Store repository.
 * @returns {Promise<{ customer: object, customerId: number,
 *   priceListId: number, priceList: object }>} The resolved customer context.
 * @throws {Error} 400 without `customer_id` for staff, 403 for an unlinked
 *   customer, another customer, an unassigned seller or a missing price list.
 */
async function resolveStoreCustomer({
  user,
  requestedCustomerId,
  repository = storeRepository,
}) {
  const role = user.role?.name ?? user.role;
  let requested = null;

  if (
    requestedCustomerId !== undefined &&
    requestedCustomerId !== null &&
    requestedCustomerId !== ""
  ) {
    requested = parseCustomerId(requestedCustomerId);

    if (requested === null) {
      if (role === CUSTOMER_ROLE) {
        throw createHttpError(403, { message: "Forbidden" });
      }

      throw createHttpError(400, {
        message: MISSING_CUSTOMER_ID_MESSAGE,
      });
    }
  }

  const scope = resolveCustomerScope(user, requested);

  if (scope.status) {
    throw createHttpError(scope.status, scope.body);
  }

  if (role === SELLER_ROLE) {
    const assigned = await repository.isCustomerAssigned(
      scope.customerId,
      readField(user, "id"),
    );

    if (!assigned) {
      throw createHttpError(403, { message: SELLER_NOT_ASSIGNED_MESSAGE });
    }
  }

  const customer = await repository.findCustomer(scope.customerId);
  const priceListId = customer ? readField(customer, "price_list_id") : null;

  if (!customer || priceListId === null || priceListId === undefined) {
    throw createHttpError(403, { message: CUSTOMER_PRICE_LIST_MESSAGE });
  }

  return {
    customer,
    customerId: scope.customerId,
    priceListId: Number(priceListId),
    priceList: readField(customer, "price_list") ?? { id: priceListId },
  };
}

/**
 * Answers a controlled store error and rethrows anything else so the global
 * handler keeps returning the generic 500.
 * @param {unknown} error - Error raised by the store service.
 * @param {import("express").Response} res - Express response.
 * @returns {import("express").Response} The error response.
 * @throws {unknown} The original error when it is not an HTTP error.
 */
function handleStoreError(error, res) {
  if (isHttpError(error)) {
    return sendHttpError(res, error);
  }

  throw error;
}

module.exports = {
  CUSTOMER_PRICE_LIST_MESSAGE,
  READ_ROLES,
  SELLER_NOT_ASSIGNED_MESSAGE,
  handleStoreError,
  readAccess,
  resolveStoreCustomer,
};
