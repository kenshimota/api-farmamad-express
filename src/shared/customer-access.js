const User = require("../models/user");
const Role = require("../models/role");

const CUSTOMER_ROLE = "customer";
const STAFF_ROLES = Object.freeze(["admin", "seller"]);

/**
 * Tells whether the authenticated user is a member of the staff roles that can
 * access every customer.
 * @param {object|null} user - Current user instance.
 * @returns {boolean} True for admin and seller.
 */
function isStaff(user) {
  return Boolean(user && STAFF_ROLES.includes(user.role?.name ?? user.role));
}

/**
 * Express middleware that loads the authenticated user row after
 * `authenticate`. Ownership rules need `customer_id`, which is not part of the
 * JWT payload, so the row is always read from the database.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadCurrentUser(req, res, next) {
  try {
    const user = await User.findByPk(req.user.sub, {
      include: { model: Role, as: "role" },
    });

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.isBlocked) {
      return res.status(403).json({ message: "User is blocked" });
    }

    req.currentUser = user;

    return next();
  } catch (error) {
    return next(error);
  }
}

/**
 * Resolves the customer id a request is allowed to operate on. Staff must send
 * it explicitly; a customer always operates on its own linked profile.
 * @param {object} user - Current user instance.
 * @param {number|null} requestedCustomerId - Parsed `customer_id` or null.
 * @returns {{ customerId: number }|{ status: number, body: object }} The
 *   resolved customer id or the HTTP error body.
 */
function resolveCustomerScope(user, requestedCustomerId) {
  const role = user.role?.name ?? user.role;

  if (role === CUSTOMER_ROLE) {
    if (!user.customer_id) {
      return {
        status: 403,
        body: { message: "Customer profile is not linked" },
      };
    }

    if (
      requestedCustomerId !== null &&
      requestedCustomerId !== undefined &&
      Number(requestedCustomerId) !== Number(user.customer_id)
    ) {
      return { status: 403, body: { message: "Forbidden" } };
    }

    return { customerId: Number(user.customer_id) };
  }

  if (requestedCustomerId === null || requestedCustomerId === undefined) {
    return {
      status: 400,
      body: { message: "customer_id is required" },
    };
  }

  return { customerId: Number(requestedCustomerId) };
}

/**
 * Tells whether a customer user owns a resource that belongs to `customerId`.
 * @param {object} user - Current user instance.
 * @param {number} customerId - Resource customer id.
 * @returns {boolean} True when the customer owns the resource.
 */
function ownsCustomer(user, customerId) {
  const role = user.role?.name ?? user.role;

  return (
    role === CUSTOMER_ROLE &&
    Boolean(user.customer_id) &&
    Number(user.customer_id) === Number(customerId)
  );
}

module.exports = {
  CUSTOMER_ROLE,
  STAFF_ROLES,
  isStaff,
  loadCurrentUser,
  ownsCustomer,
  resolveCustomerScope,
};
