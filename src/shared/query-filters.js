/**
 * Resolves the optional filters of a list endpoint from a declarative set of
 * definitions. Each definition parses one raw query value; returning
 * `null`/`undefined` marks the value as invalid.
 * @param {object} query - Express query object.
 * @param {Array<{ query: string, field: string, parse: (value: unknown) => unknown, message: string }>} definitions -
 *   Filter definitions.
 * @returns {{ filters: object }|{ errors: Record<string, string> }} The service
 *   filters or the validation errors.
 */
function resolveQueryFilters(query = {}, definitions) {
  const filters = {};
  const errors = {};

  for (const { query: name, field, parse, message } of definitions) {
    const raw = query[name];

    if (raw === undefined) {
      continue;
    }

    const parsed = parse(raw);

    if (parsed === null || parsed === undefined) {
      errors[name] = message;
    } else {
      filters[field] = parsed;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { filters };
}

module.exports = { resolveQueryFilters };
