/**
 * Error raised when robots.txt forbids a URL. The scraper must stop instead of
 * trying to bypass the site rules.
 */
class ScrapingBlockedError extends Error {
  /**
   * @param {string} path - Blocked path.
   */
  constructor(path) {
    super(
      `robots.txt does not allow scraping ${path}. The scraper stopped without bypassing the site rules.`,
    );
    this.name = "ScrapingBlockedError";
    this.path = path;
  }
}

/**
 * Parses robots.txt into user-agent groups with their allow/disallow rules.
 * @param {string} content - robots.txt body.
 * @returns {{ agent: string, rules: { type: string, path: string }[] }[]}
 *   Parsed groups.
 */
function parseRobots(content = "") {
  const groups = [];
  let current = null;
  let expectingAgent = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();

    if (!line) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!current || !expectingAgent) {
        current = { agent: value, rules: [] };
        groups.push(current);
        expectingAgent = true;
      } else {
        current.agent = value;
      }
      continue;
    }

    if (!current) {
      continue;
    }

    expectingAgent = false;

    if (field === "allow" || field === "disallow") {
      if (value) {
        current.rules.push({ type: field, path: value });
      }
    }
  }

  return groups;
}

/**
 * Selects the most specific group for a user agent: the exact product token,
 * otherwise the wildcard group.
 * @param {{ agent: string, rules: object[] }[]} groups - Parsed groups.
 * @param {string} userAgent - Full User-Agent header.
 * @returns {{ agent: string, rules: object[] }|null} Matching group.
 */
function selectGroup(groups, userAgent) {
  const normalized = userAgent.toLowerCase();

  return (
    groups.find(
      (group) =>
        group.agent !== "*" &&
        group.agent !== "" &&
        normalized.includes(group.agent.toLowerCase()),
    ) ||
    groups.find((group) => group.agent === "*") ||
    null
  );
}

/**
 * Checks whether a path is allowed by the matching robots.txt group. The
 * longest matching rule wins, as search engines implement it.
 * @param {object[]} groups - Parsed groups.
 * @param {string} pathname - Path to check, including the query string.
 * @param {string} userAgent - Full User-Agent header.
 * @returns {boolean} True when the path is allowed.
 */
function isAllowed(groups, pathname, userAgent) {
  const group = selectGroup(groups, userAgent);

  if (!group) {
    return true;
  }

  let winner = null;

  for (const rule of group.rules) {
    const pattern = rule.path.replace(/\*$/, "");

    if (!pathname.startsWith(pattern)) {
      continue;
    }

    if (!winner || pattern.length >= winner.pattern.length) {
      winner = { ...rule, pattern };
    }
  }

  return !winner || winner.type === "allow";
}

/**
 * Fails with an actionable error when robots.txt forbids a path.
 * @param {object[]} groups - Parsed groups.
 * @param {string} pathname - Path to check.
 * @param {string} userAgent - Full User-Agent header.
 * @returns {void}
 * @throws {ScrapingBlockedError} When the path is disallowed.
 */
function assertAllowed(groups, pathname, userAgent) {
  if (!isAllowed(groups, pathname, userAgent)) {
    throw new ScrapingBlockedError(pathname);
  }
}

module.exports = {
  ScrapingBlockedError,
  assertAllowed,
  isAllowed,
  parseRobots,
  selectGroup,
};
