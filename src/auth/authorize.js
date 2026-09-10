/**
 * Builds an Express middleware that only allows users whose JWT role is one
 * of the accepted roles.
 * @param {...string} allowedRoles - Role names allowed to continue.
 * @returns {import("express").RequestHandler} The authorization middleware.
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    const role = req.user && req.user.role;

    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return next();
  };
}

module.exports = { authorize };
