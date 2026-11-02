const { Op } = require("sequelize");
const {
  buildDayRange,
  buildNumberSearch,
  buildTextSearch,
  needsListOptions,
  parseDateOnly,
  parseListQuery,
  parseNonEmptyString,
} = require("./list-query");
const { parseBooleanFlag, parsePositiveInteger } = require("./parsers");

const CONFIG = {
  filters: [
    {
      query: "category_id",
      field: "categoryId",
      parse: parsePositiveInteger,
      message: "Invalid category_id",
    },
    {
      query: "is_active",
      field: "isActive",
      parse: (value) => {
        const parsed = parseBooleanFlag(value);
        return parsed === undefined ? null : parsed;
      },
      message: "Invalid is_active",
    },
  ],
  sortFields: ["id", "name", "reference"],
  defaultOrder: [["id", "ASC"]],
};

describe("parseListQuery", () => {
  it("keeps the flat mode without page or page_size", () => {
    const result = parseListQuery({}, CONFIG);

    expect(result.errors).toBeUndefined();
    expect(result.pagination).toEqual({
      enabled: false,
      page: 1,
      pageSize: 20,
    });
    expect(result.order).toEqual([["id", "ASC"]]);
    expect(result.q).toBeUndefined();
    expect(result.filters).toEqual({});
  });

  it("enables pagination when only page is sent", () => {
    const result = parseListQuery({ page: "3" }, CONFIG);

    expect(result.pagination).toEqual({ enabled: true, page: 3, pageSize: 20 });
  });

  it("enables pagination when only page_size is sent", () => {
    const result = parseListQuery({ page_size: "100" }, CONFIG);

    expect(result.pagination).toEqual({
      enabled: true,
      page: 1,
      pageSize: 100,
    });
  });

  it.each([
    [{ page: "0" }, { page: "Invalid page" }],
    [{ page: "-1" }, { page: "Invalid page" }],
    [{ page: "1.5" }, { page: "Invalid page" }],
    [{ page_size: "0" }, { page_size: "Invalid page_size" }],
    [{ page_size: "101" }, { page_size: "Invalid page_size" }],
    [{ page_size: "abc" }, { page_size: "Invalid page_size" }],
    [{ sort: "description" }, { sort: "Invalid sort" }],
    [{ order: "sideways" }, { order: "Invalid order" }],
    [{ category_id: "abc" }, { category_id: "Invalid category_id" }],
    [{ is_active: "yes" }, { is_active: "Invalid is_active" }],
  ])("answers 422 for %p", (query, errors) => {
    expect(parseListQuery(query, CONFIG)).toEqual({ errors });
  });

  it("collects every invalid parameter in one error object", () => {
    expect(
      parseListQuery({ page: "0", sort: "nope", category_id: "x" }, CONFIG),
    ).toEqual({
      errors: {
        page: "Invalid page",
        sort: "Invalid sort",
        category_id: "Invalid category_id",
      },
    });
  });

  it("builds the order from the whitelisted sort and appends id", () => {
    expect(
      parseListQuery({ sort: "name", order: "desc" }, CONFIG).order,
    ).toEqual([
      ["name", "DESC"],
      ["id", "ASC"],
    ]);
    expect(parseListQuery({ sort: "id", order: "DESC" }, CONFIG).order).toEqual(
      [["id", "DESC"]],
    );
    expect(parseListQuery({ sort: "name" }, CONFIG).order).toEqual([
      ["name", "ASC"],
      ["id", "ASC"],
    ]);
  });

  it("uses a stable default order when pagination is enabled", () => {
    const config = { ...CONFIG, defaultOrder: [["name", "ASC"]] };

    expect(parseListQuery({ page: "1" }, config).order).toEqual([
      ["name", "ASC"],
      ["id", "ASC"],
    ]);
  });

  it("preserves the module default order without pagination", () => {
    const config = {
      ...CONFIG,
      defaultOrder: [
        ["number", "DESC"],
        ["id", "DESC"],
      ],
    };

    expect(parseListQuery({}, config).order).toEqual([
      ["number", "DESC"],
      ["id", "DESC"],
    ]);
  });

  it("trims q and ignores a blank term", () => {
    expect(parseListQuery({ q: "  ibu  " }, CONFIG).q).toBe("ibu");
    expect(parseListQuery({ q: "   " }, CONFIG).q).toBeUndefined();
  });

  it("rejects a non-string q", () => {
    expect(parseListQuery({ q: ["ibu"] }, CONFIG)).toEqual({
      errors: { q: "Invalid q" },
    });
  });

  it("parses every valid filter", () => {
    const result = parseListQuery(
      { category_id: "3", is_active: "false" },
      CONFIG,
    );

    expect(result.filters).toEqual({ categoryId: 3, isActive: false });
  });

  it("ignores unknown query parameters", () => {
    const result = parseListQuery({ unknown: "x", all: "true" }, CONFIG);

    expect(result.errors).toBeUndefined();
    expect(result.pagination.enabled).toBe(false);
    expect(result.filters).toEqual({});
  });
});

describe("needsListOptions", () => {
  it("is false for a flat listing without sort", () => {
    expect(needsListOptions(parseListQuery({}, CONFIG))).toBe(false);
  });

  it("is true when pagination is enabled", () => {
    expect(needsListOptions(parseListQuery({ page: "1" }, CONFIG))).toBe(true);
  });

  it("is true when only sort is sent", () => {
    expect(needsListOptions(parseListQuery({ sort: "name" }, CONFIG))).toBe(
      true,
    );
  });
});

describe("parseNonEmptyString", () => {
  it("trims the text", () => {
    expect(parseNonEmptyString("  ibu  ")).toBe("ibu");
  });

  it.each([null, undefined, 1, ["ibu"], "", "   "])("rejects %p", (value) => {
    expect(parseNonEmptyString(value)).toBeNull();
  });
});

describe("parseDateOnly", () => {
  it.each(["2026-01-01", "2026-02-28", "2028-02-29"])("accepts %s", (value) => {
    expect(parseDateOnly(value)).toBe(value);
  });

  it.each([
    "2026-02-30",
    "2026-13-01",
    "2026-1-1",
    "01/01/2026",
    "",
    "   ",
    null,
    undefined,
    ["2026-01-01"],
  ])("rejects %p", (value) => {
    expect(parseDateOnly(value)).toBeNull();
  });
});

describe("buildDayRange", () => {
  it("builds an inclusive timestamp range", () => {
    const range = buildDayRange("paid_at", "2026-01-01", "2026-01-31");

    expect(range).toEqual({
      paid_at: {
        [Op.gte]: new Date("2026-01-01T00:00:00.000Z"),
        [Op.lte]: new Date("2026-01-31T23:59:59.999Z"),
      },
    });
  });

  it("supports DATEONLY columns and optional bounds", () => {
    expect(
      buildDayRange("due_date", "2026-01-01", null, { dateOnly: true }),
    ).toEqual({ due_date: { [Op.gte]: "2026-01-01" } });
    expect(
      buildDayRange("due_date", null, "2026-01-31", { dateOnly: true }),
    ).toEqual({ due_date: { [Op.lte]: "2026-01-31" } });
    expect(buildDayRange("due_date", null, null)).toBeNull();
  });
});

describe("search builders", () => {
  it("builds a case-insensitive partial text filter", () => {
    expect(buildTextSearch("ibu", ["name", "reference"])).toEqual({
      [Op.or]: [
        { name: { [Op.iLike]: "%ibu%" } },
        { reference: { [Op.iLike]: "%ibu%" } },
      ],
    });
  });

  it("builds a numeric search by casting the column to text", () => {
    const filter = buildNumberSearch("12", ["number"]);

    expect(filter[Op.or]).toHaveLength(1);
    expect(filter[Op.or][0]).toBeDefined();
  });

  it("returns null for an empty search", () => {
    expect(buildTextSearch("", ["name"])).toBeNull();
    expect(buildNumberSearch("  ", ["number"])).toBeNull();
  });
});
