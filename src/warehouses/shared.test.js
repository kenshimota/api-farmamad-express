jest.mock("../models/warehouse", () => ({ findByPk: jest.fn() }));

const { Op } = require("sequelize");
const Warehouse = require("../models/warehouse");
const {
  buildSearchFilter,
  loadWarehouse,
  normalizeSearch,
  requireWarehouseFields,
} = require("./shared");

/**
 * Builds a minimal Express response double that records the status and body.
 * @returns {object} Response double with status and json spies.
 */
function response() {
  return {
    statusCode: 200,
    body: undefined,
    status: jest.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn(function json(body) {
      this.body = body;
      return this;
    }),
  };
}

beforeEach(() => {
  Warehouse.findByPk.mockReset();
});

describe("loadWarehouse", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadWarehouse({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid warehouse id" } });
    expect(Warehouse.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the warehouse does not exist", async () => {
    Warehouse.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadWarehouse({ params: { id: "999" } }, res, next);

    expect(Warehouse.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Warehouse not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the warehouse and continues when it exists", async () => {
    const warehouse = { id: 1, name: "Bodega Central" };
    Warehouse.findByPk.mockResolvedValue(warehouse);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadWarehouse(req, res, next);

    expect(Warehouse.findByPk).toHaveBeenCalledWith(1);
    expect(req.warehouse).toBe(warehouse);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("requireWarehouseFields", () => {
  it.each([
    {},
    { name: "Bodega Central" },
    { address: "Av. Monseñor Rivero 123" },
  ])("answers 400 with the combined message for %p", (body) => {
    const req = { body };
    const res = response();
    const next = jest.fn();

    requireWarehouseFields(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      message: "name and address are required",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("continues when both required fields are present", () => {
    const req = {
      body: { name: "Bodega Central", address: "Av. Monseñor Rivero 123" },
    };
    const res = response();
    const next = jest.fn();

    requireWarehouseFields(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("normalizeSearch", () => {
  it.each([
    [undefined, null],
    [null, null],
    ["", null],
    ["   ", null],
    ["  central  ", "central"],
    ["CENTRAL", "CENTRAL"],
    [["central"], null],
    [{ term: "central" }, null],
    [123, null],
  ])("normalizes %p as %p", (value, expected) => {
    expect(normalizeSearch(value)).toBe(expected);
  });
});

describe("buildSearchFilter", () => {
  it("builds a case-insensitive partial filter over the three text fields", () => {
    expect(buildSearchFilter("central")).toEqual({
      [Op.or]: [
        { name: { [Op.iLike]: "%central%" } },
        { observations: { [Op.iLike]: "%central%" } },
        { address: { [Op.iLike]: "%central%" } },
      ],
    });
  });
});
