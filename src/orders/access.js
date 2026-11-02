const { createHttpError } = require("../shared/http-error");
const { readField } = require("../shared/serializer");
const { ALLOWED_ROLES, CUSTOMER_ROLE, INTERNAL_ROLES } = require("./constants");
const {
  customerNotFound,
  customerProfileNotLinked,
  forbidden,
  orderNotFound,
  priceListNotAssigned,
  sellerNotAssigned,
  unauthorized,
} = require("./errors");

/**
 * Creates the access helpers shared by every order operation.
 * @param {object} dependencies - Injectable dependencies.
 * @param {object} dependencies.repository - Order repository.
 * @returns {object} The access helpers.
 */
function createOrderAccess({ repository }) {
  /**
   * Resolves the authenticated actor into an internal context.
   * @param {object} actor - JWT payload.
   * @returns {Promise<{ role: string, userId: number,
   *   customerId: number|null }>} The actor context.
   */
  async function resolveContext(actor) {
    const role = actor?.role;

    if (!ALLOWED_ROLES.includes(role)) {
      throw forbidden();
    }

    if (role !== CUSTOMER_ROLE) {
      return { role, userId: Number(actor.sub), customerId: null };
    }

    const user = await repository.findUserById(actor.sub);

    if (!user) {
      throw unauthorized();
    }

    const customerId = readField(user, "customer_id");

    if (customerId === null || customerId === undefined) {
      throw customerProfileNotLinked();
    }

    return {
      role,
      userId: Number(readField(user, "id")),
      customerId: Number(customerId),
      user,
    };
  }

  /**
   * Ensures a seller is assigned to the customer.
   * @param {number} customerId - Customer id.
   * @param {number} userId - Seller user id.
   * @param {() => Error} [factory] - Error builder.
   * @returns {Promise<void>}
   */
  async function assertSellerAssigned(
    customerId,
    userId,
    factory = sellerNotAssigned,
  ) {
    const assignment = await repository.findCustomerSeller(customerId, userId);

    if (!assignment) {
      throw factory();
    }
  }

  /**
   * Resolves the target customer of a new order and enforces the role rules.
   * @param {object} input - Validated create body.
   * @param {object} context - Actor context.
   * @returns {Promise<{ customer: object, customerId: number,
   *   priceListId: number }>} The target customer context.
   */
  async function resolveCreateCustomer(input, context) {
    let customer;

    if (context.role === CUSTOMER_ROLE) {
      customer = await repository.findCustomerById(context.customerId);

      if (!customer) {
        throw customerProfileNotLinked();
      }
    } else {
      if (input.customer_id === undefined || input.customer_id === null) {
        throw createHttpError(400, { message: "customer_id is required" });
      }

      customer = await repository.findCustomerById(input.customer_id);

      if (!customer) {
        throw customerNotFound();
      }

      if (context.role === "seller") {
        await assertSellerAssigned(customer.id, context.userId);
      }
    }

    const priceListId = readField(customer, "price_list_id");

    if (priceListId === null || priceListId === undefined) {
      throw priceListNotAssigned();
    }

    return {
      customer,
      customerId: Number(readField(customer, "id")),
      priceListId: Number(priceListId),
    };
  }

  /**
   * Hides orders that a customer does not own. Internal roles can read every
   * order; write access is enforced separately.
   * @param {object} order - Loaded order.
   * @param {object} context - Actor context.
   * @returns {void}
   */
  function assertViewAccess(order, context) {
    if (
      context.role === CUSTOMER_ROLE &&
      Number(readField(order, "customer_id")) !== context.customerId
    ) {
      throw orderNotFound();
    }
  }

  /**
   * Enforces write access: the owning customer, any admin or the assigned
   * seller. A seller without the assignment receives a hidden 404.
   * @param {object} order - Loaded order.
   * @param {object} context - Actor context.
   * @returns {Promise<void>}
   */
  async function assertEditAccess(order, context) {
    assertViewAccess(order, context);

    if (!INTERNAL_ROLES.includes(context.role)) {
      return;
    }

    if (context.role === "seller") {
      await assertSellerAssigned(
        Number(readField(order, "customer_id")),
        context.userId,
        orderNotFound,
      );
    }
  }

  return {
    assertEditAccess,
    assertSellerAssigned,
    assertViewAccess,
    isInternal: (context) => INTERNAL_ROLES.includes(context.role),
    resolveContext,
    resolveCreateCustomer,
  };
}

module.exports = { createOrderAccess };
