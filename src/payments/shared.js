const { paymentService } = require("./service");
const { invalidPaymentId, paymentNotFound } = require("./errors");
const { parsePaymentId } = require("./parsers");
const { ownsCustomer } = require("../shared/customer-access");

/**
 * Express middleware for routes addressed by `:id`. It parses the parameter,
 * loads the payment and answers 422/404 when needed. A customer can only reach
 * its own payments; another customer's payment is hidden behind a 404.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after calling next or answering an error.
 */
async function loadPayment(req, res, next) {
  const id = parsePaymentId(req.params.id);

  if (id === null) {
    return res.status(422).json(invalidPaymentId().body);
  }

  const payment = await paymentService.getPayment(id);

  if (!payment) {
    return res.status(404).json(paymentNotFound().body);
  }

  const user = req.currentUser;
  const role = user?.role?.name ?? user?.role;

  if (role === "customer" && !user.customer_id) {
    return res.status(403).json({ message: "Customer profile is not linked" });
  }

  if (role === "customer" && !ownsCustomer(user, payment.customer_id)) {
    return res.status(404).json(paymentNotFound().body);
  }

  req.payment = payment;

  return next();
}

module.exports = { loadPayment };
