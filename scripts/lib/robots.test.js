const {
  assertAllowed,
  isAllowed,
  parseRobots,
  ScrapingBlockedError,
} = require("./robots");

const ROBOTS = `
User-Agent: *
Disallow: /checkout*
Disallow: /buscar*
Disallow: /producto/*/review
Allow: /producto/

User-Agent: FarmamadDemoBot
Disallow: /privado

User-Agent: Scrapy
Disallow: /
`;

describe("robots.txt rules", () => {
  it("parses every group", () => {
    const groups = parseRobots(ROBOTS);

    expect(groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ agent: "*" }),
        expect.objectContaining({ agent: "FarmamadDemoBot" }),
        expect.objectContaining({ agent: "Scrapy" }),
      ]),
    );
  });

  it("uses the group that matches the user agent when present", () => {
    const groups = parseRobots(ROBOTS);

    expect(isAllowed(groups, "/producto/123", "FarmamadDemoBot")).toBe(true);
    expect(isAllowed(groups, "/privado/x", "FarmamadDemoBot")).toBe(false);
  });

  it("falls back to the wildcard group", () => {
    const groups = parseRobots(ROBOTS);

    expect(isAllowed(groups, "/producto/123", "AnotherBot")).toBe(true);
    expect(isAllowed(groups, "/buscar?q=x", "AnotherBot")).toBe(false);
  });

  it("applies the longest matching rule", () => {
    const groups = parseRobots(`
User-Agent: *
Disallow: /producto/
Allow: /producto/permitido
`);

    expect(isAllowed(groups, "/producto/otro", "Bot")).toBe(false);
    expect(isAllowed(groups, "/producto/permitido/1", "Bot")).toBe(true);
  });

  it("throws an actionable error when a path is disallowed", () => {
    const groups = parseRobots(ROBOTS);

    expect(() =>
      assertAllowed(groups, "/privado/x", "FarmamadDemoBot"),
    ).toThrow(ScrapingBlockedError);
    expect(() =>
      assertAllowed(groups, "/privado/x", "FarmamadDemoBot"),
    ).toThrow(/robots\.txt/);
  });
});
