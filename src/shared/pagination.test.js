const {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildMeta,
  buildPaginatedResponse,
  findPage,
  parsePage,
  parsePageSize,
  sendListResponse,
} = require("./pagination");

describe("parsePage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["  15  ", 15],
    [3, 3],
  ])("accepts %p", (value, expected) => {
    expect(parsePage(value)).toBe(expected);
  });

  it.each(["0", "-1", "1.5", "abc", "", " ", null, undefined, ["1"], {}])(
    "rejects %p",
    (value) => {
      expect(parsePage(value)).toBeNull();
    },
  );
});

describe("parsePageSize", () => {
  it.each([
    ["1", 1],
    ["20", 20],
    ["100", 100],
    [10, 10],
  ])("accepts %p", (value, expected) => {
    expect(parsePageSize(value)).toBe(expected);
  });

  it.each(["0", "-1", "101", "1.5", "abc", "", null, undefined, ["10"], {}])(
    "rejects %p",
    (value) => {
      expect(parsePageSize(value)).toBeNull();
    },
  );

  it("exposes the documented defaults and bounds", () => {
    expect(DEFAULT_PAGE).toBe(1);
    expect(DEFAULT_PAGE_SIZE).toBe(20);
    expect(MAX_PAGE_SIZE).toBe(100);
  });
});

describe("buildMeta", () => {
  it("computes the pagination envelope with a partial page", () => {
    expect(buildMeta({ page: 2, pageSize: 10, total: 57 })).toEqual({
      page: 2,
      page_size: 10,
      total: 57,
      total_pages: 6,
      has_next: true,
      has_prev: true,
    });
  });

  it("uses zero total pages and no next page for an empty result", () => {
    expect(buildMeta({ page: 1, pageSize: 20, total: 0 })).toEqual({
      page: 1,
      page_size: 20,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
    });
  });

  it("keeps has_prev true when an out-of-range page is requested", () => {
    expect(buildMeta({ page: 5, pageSize: 20, total: 3 })).toEqual({
      page: 5,
      page_size: 20,
      total: 3,
      total_pages: 1,
      has_next: false,
      has_prev: true,
    });
  });
});

describe("buildPaginatedResponse", () => {
  it("maps the rows and wraps them with the meta", () => {
    const response = buildPaginatedResponse(
      [{ id: 1 }, { id: 2 }],
      { page: 1, pageSize: 10, total: 2 },
      (row) => row.id,
    );

    expect(response).toEqual({
      data: [1, 2],
      meta: {
        page: 1,
        page_size: 10,
        total: 2,
        total_pages: 1,
        has_next: false,
        has_prev: false,
      },
    });
  });
});

describe("sendListResponse", () => {
  function createResponse() {
    return { json: jest.fn((payload) => payload) };
  }

  it("sends a flat array and maps every row when there is no pagination", () => {
    const res = createResponse();

    sendListResponse(res, [{ id: 1 }, { id: 2 }], (row) => row.id);

    expect(res.json).toHaveBeenCalledWith([1, 2]);
  });

  it("sends the envelope with the stored meta when pagination is enabled", () => {
    const res = createResponse();
    const meta = {
      page: 2,
      page_size: 10,
      total: 21,
      total_pages: 3,
      has_next: true,
      has_prev: true,
    };

    sendListResponse(res, { rows: [{ id: 1 }], meta }, (row) => row.id);

    expect(res.json).toHaveBeenCalledWith({ data: [1], meta });
  });

  it("keeps the rows untouched when no serializer is provided", () => {
    const res = createResponse();
    const rows = [{ id: 1 }];

    sendListResponse(res, rows);

    expect(res.json).toHaveBeenCalledWith(rows);
  });
});

describe("findPage", () => {
  it("runs findAll when pagination is not requested", async () => {
    const rows = [{ id: 1 }];
    const model = { findAll: jest.fn().mockResolvedValue(rows) };
    const options = { order: [["id", "ASC"]] };

    await expect(findPage(model, options, { enabled: false })).resolves.toEqual(
      rows,
    );
    expect(model.findAll).toHaveBeenCalledWith(options);
  });

  it("runs findAndCountAll with limit and offset when paginated", async () => {
    const rows = [{ id: 1 }];
    const model = {
      findAndCountAll: jest.fn().mockResolvedValue({ rows, count: 21 }),
    };

    const result = await findPage(
      model,
      { order: [["id", "ASC"]] },
      { enabled: true, page: 2, pageSize: 10 },
    );

    expect(model.findAndCountAll).toHaveBeenCalledWith({
      order: [["id", "ASC"]],
      limit: 10,
      offset: 10,
      distinct: true,
    });
    expect(result).toEqual({
      rows,
      meta: {
        page: 2,
        page_size: 10,
        total: 21,
        total_pages: 3,
        has_next: true,
        has_prev: true,
      },
    });
  });

  it("does not run the count query when pagination is absent", async () => {
    const model = {
      findAll: jest.fn().mockResolvedValue([]),
      findAndCountAll: jest.fn(),
    };

    await findPage(model, {}, { enabled: false });

    expect(model.findAndCountAll).not.toHaveBeenCalled();
  });
});
