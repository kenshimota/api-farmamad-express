const { methodPaymentService } = require("./service");
const { invalidMethodPaymentId, methodPaymentNotFound } = require("./errors");
const { parseMethodPaymentId } = require("./parsers");
const { createResourceLoader } = require("../shared/resource-loader");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the method and answers 422/404 when needed.
 */
const loadMethodPayment = createResourceLoader({
  parseId: parseMethodPaymentId,
  load: (id) => methodPaymentService.getMethodPayment(id),
  invalidId: invalidMethodPaymentId,
  notFound: methodPaymentNotFound,
  attribute: "methodPayment",
});

module.exports = { loadMethodPayment };
