const {
  formatValidationErrors,
  missingFields,
  requiredFieldsMessage,
} = require("./validators");

/**
 * Express middleware factory that validates `req.body` against a yup schema.
 * Missing required fields answer 400 with every required field listed, format
 * errors answer 422, and the validated data (trimmed, unknown fields stripped)
 * is exposed as `req.validated` so handlers stay free of HTTP concerns.
 * @param {object} options - Middleware options.
 * @param {import("yup").Schema} options.schema - Schema with the format rules.
 * @param {string[]} options.fields - Required field names.
 * @returns {import("express").RequestHandler} The validation middleware.
 */
function validateRequest({ schema, fields }) {
  return async function validate(req, res, next) {
    const body = req.body ?? {};

    if (missingFields(body, fields).length) {
      return res.status(400).json({ message: requiredFieldsMessage(fields) });
    }

    try {
      req.validated = await schema.validate(body, {
        abortEarly: false,
        stripUnknown: true,
      });

      return next();
    } catch (error) {
      return res.status(422).json({ errors: formatValidationErrors(error) });
    }
  };
}

module.exports = { validateRequest };
