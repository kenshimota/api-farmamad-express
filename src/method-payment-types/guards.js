const { REQUIRED_METHOD_PAYMENT_TYPE_FIELDS } = require("./fields");
const {
  READ_ROLES,
  WRITE_ROLES,
  createAccessGuards,
} = require("../shared/access-guards");

const { readAccess, requireAnyField, validatedBody, writeAccess } =
  createAccessGuards({
    requiredFields: REQUIRED_METHOD_PAYMENT_TYPE_FIELDS,
  });

module.exports = {
  READ_ROLES,
  WRITE_ROLES,
  readAccess,
  requireAnyField,
  validatedBody,
  writeAccess,
};
