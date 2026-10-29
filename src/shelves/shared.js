const { shelfService } = require("./shelf-service");
const { sectionService } = require("./section-service");
const {
  invalidRouteShelfId,
  invalidSectionId,
  invalidShelfId,
  sectionNotFound,
  sendHttpError,
  shelfNotFound,
} = require("./errors");
const { parseSectionId, parseShelfId } = require("./validators");

/**
 * Builds the middleware that resolves a route parameter into a loaded record.
 * Every loader follows the same template: parse the id (422 when malformed),
 * load the record (404 when missing), expose it on `req` and continue.
 * @param {object} options - Loader options.
 * @param {string} options.param - Route parameter name.
 * @param {(value: unknown) => number|null} options.parse - Id parser.
 * @param {() => Error} options.invalidId - 422 error builder.
 * @param {(id: number, req: import("express").Request) =>
 *   Promise<object|null>} options.load - Record loader.
 * @param {() => Error} options.notFound - 404 error builder.
 * @param {string} options.target - Request property that receives the record.
 * @returns {import("express").RequestHandler} The loader middleware.
 */
function createLoader({ param, parse, invalidId, load, notFound, target }) {
  return async function loadRecord(req, res, next) {
    const id = parse(req.params[param]);

    if (id === null) {
      return sendHttpError(res, invalidId());
    }

    const record = await load(id, req);

    if (!record) {
      return sendHttpError(res, notFound());
    }

    req[target] = record;

    return next();
  };
}

/**
 * Express middleware for the shelf routes addressed by `:id`. It parses the
 * parameter, loads the shelf with its sections and answers 422/404 when needed.
 */
const loadShelf = createLoader({
  param: "id",
  parse: parseShelfId,
  invalidId: invalidShelfId,
  load: (id) => shelfService.getShelf(id),
  notFound: shelfNotFound,
  target: "shelf",
});

/**
 * Express middleware for the nested section routes. It parses `:shelf_id` and
 * loads its parent shelf without the sections.
 */
const loadRouteShelf = createLoader({
  param: "shelf_id",
  parse: parseShelfId,
  invalidId: invalidRouteShelfId,
  load: (id) => shelfService.getShelfWithoutSections(id),
  notFound: shelfNotFound,
  target: "shelf",
});

/**
 * Express middleware for the nested section routes. It requires the parent
 * shelf loaded by `loadRouteShelf` and looks the section up scoped to it, so a
 * section from another shelf answers 404.
 */
const loadSection = createLoader({
  param: "section_id",
  parse: parseSectionId,
  invalidId: invalidSectionId,
  load: (id, req) => sectionService.getSection(req.shelf.id, id),
  notFound: sectionNotFound,
  target: "section",
});

module.exports = { loadRouteShelf, loadSection, loadShelf };
