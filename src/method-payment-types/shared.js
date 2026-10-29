const { methodPaymentTypeService } = require("./service");
const {
  invalidMethodPaymentTypeId,
  methodPaymentTypeNotFound,
} = require("./errors");
const { parseMethodPaymentTypeId } = require("./parsers");
const { createResourceLoader } = require("../shared/resource-loader");

/**
 * Express middleware for the routes addressed by `:id`. It parses the
 * parameter, loads the type and answers 422/404 when needed.
 */
const loadMethodPaymentType = createResourceLoader({
  parseId: parseMethodPaymentTypeId,
  load: (id) => methodPaymentTypeService.getMethodPaymentType(id),
  invalidId: invalidMethodPaymentTypeId,
  notFound: methodPaymentTypeNotFound,
  attribute: "methodPaymentType",
});

module.exports = { loadMethodPaymentType };
