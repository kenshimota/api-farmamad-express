const { sendHttpError } = require("./http-error");

/**
 * Builds the Express middleware of a route addressed by `:id`. It parses the
 * parameter, loads the resource and answers 422/404 when needed. The factories
 * are injectable so each module keeps its own messages and service.
 * @param {object} options - Loader configuration.
 * @param {(value: unknown) => number|null} options.parseId - Route id parser.
 * @param {(id: number) => Promise<object|null>} options.load - Resource loader.
 * @param {() => Error} options.invalidId - 422 error factory.
 * @param {() => Error} options.notFound - 404 error factory.
 * @param {string} options.attribute - Request property that receives the load.
 * @returns {import("express").RequestHandler} The middleware.
 */
function createResourceLoader({
  parseId,
  load,
  invalidId,
  notFound,
  attribute,
}) {
  return async function loadResource(req, res, next) {
    const id = parseId(req.params.id);

    if (id === null) {
      return sendHttpError(res, invalidId());
    }

    const resource = await load(id);

    if (!resource) {
      return sendHttpError(res, notFound());
    }

    req[attribute] = resource;

    return next();
  };
}

module.exports = { createResourceLoader };
