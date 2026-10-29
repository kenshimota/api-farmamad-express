jest.mock("../models/supplier", () => ({
  create: jest.fn(),
  findAll: jest.fn(),
  findByPk: jest.fn(),
}));
jest.mock("../models/city", () => ({ findByPk: jest.fn() }));
jest.mock("../models/state", () => ({ findByPk: jest.fn() }));

const {
  ForeignKeyConstraintError,
  UniqueConstraintError,
} = require("sequelize");
const Supplier = require("../models/supplier");
const City = require("../models/city");
const State = require("../models/state");
const {
  LOCATION_INCLUDE,
  ensureLocation,
  handleDeleteError,
  handleWriteError,
  loadSupplier,
  loadSupplierWithLocation,
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
  Supplier.findByPk.mockReset();
  City.findByPk.mockReset();
  State.findByPk.mockReset();
});

describe("loadSupplier", () => {
  it("answers 422 when the id is not a positive integer", async () => {
    const res = response();
    const next = jest.fn();

    await loadSupplier({ params: { id: "abc" } }, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { id: "Invalid supplier id" } });
    expect(Supplier.findByPk).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 404 when the supplier does not exist", async () => {
    Supplier.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await loadSupplier({ params: { id: "999" } }, res, next);

    expect(Supplier.findByPk).toHaveBeenCalledWith(999);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Supplier not found" });
    expect(next).not.toHaveBeenCalled();
  });

  it("exposes the supplier and continues when it exists", async () => {
    const supplier = { id: 1 };
    Supplier.findByPk.mockResolvedValue(supplier);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadSupplier(req, res, next);

    expect(Supplier.findByPk).toHaveBeenCalledWith(1);
    expect(req.supplier).toBe(supplier);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("loads the nested location for the detail endpoint", async () => {
    const supplier = { id: 1 };
    Supplier.findByPk.mockResolvedValue(supplier);
    const req = { params: { id: "1" } };
    const res = response();
    const next = jest.fn();

    await loadSupplierWithLocation(req, res, next);

    expect(Supplier.findByPk).toHaveBeenCalledWith(1, {
      include: LOCATION_INCLUDE,
    });
    expect(req.supplier).toBe(supplier);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("ensureLocation", () => {
  it("accepts a coherent city and state", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 4 });
    State.findByPk.mockResolvedValue({ id: 4 });
    const req = { validated: { city_id: 10, state_id: 4 } };
    const res = response();
    const next = jest.fn();

    await ensureLocation(req, res, next);

    expect(City.findByPk).toHaveBeenCalledWith(10);
    expect(State.findByPk).toHaveBeenCalledWith(4);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("answers 422 when the city does not exist", async () => {
    City.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await ensureLocation(
      { validated: { city_id: 999, state_id: 4 } },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { city_id: "Invalid city id" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 422 when the state does not exist", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 4 });
    State.findByPk.mockResolvedValue(null);
    const res = response();
    const next = jest.fn();

    await ensureLocation(
      { validated: { city_id: 10, state_id: 999 } },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({ errors: { state_id: "Invalid state" } });
    expect(next).not.toHaveBeenCalled();
  });

  it("answers 422 when the city does not belong to the state", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 5 });
    State.findByPk.mockResolvedValue({ id: 4 });
    const res = response();
    const next = jest.fn();

    await ensureLocation(
      { validated: { city_id: 10, state_id: 4 } },
      res,
      next,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("derives the state when only city_id changes", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 5 });
    const req = { validated: { city_id: 10 } };
    const res = response();
    const next = jest.fn();

    await ensureLocation(req, res, next);

    expect(req.validated).toEqual({ city_id: 10, state_id: 5 });
    expect(State.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("validates the state against the current city when only state_id changes", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 5 });
    State.findByPk.mockResolvedValue({ id: 5 });
    const req = {
      validated: { state_id: 5 },
      supplier: { id: 1, city_id: 10, state_id: 4 },
    };
    const res = response();
    const next = jest.fn();

    await ensureLocation(req, res, next);

    expect(City.findByPk).toHaveBeenCalledWith(10);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects an incoherent state change against the current city", async () => {
    City.findByPk.mockResolvedValue({ id: 10, state_id: 4 });
    State.findByPk.mockResolvedValue({ id: 5 });
    const req = {
      validated: { state_id: 5 },
      supplier: { id: 1, city_id: 10, state_id: 4 },
    };
    const res = response();
    const next = jest.fn();

    await ensureLocation(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      errors: { city_id: "City does not belong to state" },
    });
  });

  it("skips the checks when no location field is provided", async () => {
    const res = response();
    const next = jest.fn();

    await ensureLocation({ validated: { name: "Nuevo" } }, res, next);

    expect(City.findByPk).not.toHaveBeenCalled();
    expect(State.findByPk).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("handleWriteError", () => {
  it("answers 409 when the identification already exists", () => {
    const res = response();

    handleWriteError(new UniqueConstraintError({ message: "duplicate" }), res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Supplier already exists" });
  });

  it.each([
    ["city_id", { errors: { city_id: "Invalid city id" } }],
    ["state_id", { errors: { state_id: "Invalid state" } }],
  ])("answers 422 when the %s foreign key is missing", (field, body) => {
    const res = response();

    handleWriteError(
      new ForeignKeyConstraintError({
        message: "foreign key",
        fields: { [field]: 1 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual(body);
  });

  it("rethrows an unclassified foreign key error", () => {
    const error = new ForeignKeyConstraintError({ message: "foreign key" });

    expect(() => handleWriteError(error, response())).toThrow(error);
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleWriteError(error, response())).toThrow(error);
  });
});

describe("handleDeleteError", () => {
  it("answers 409 when purchases reference the supplier", () => {
    const res = response();

    handleDeleteError(
      new ForeignKeyConstraintError({ message: "foreign key" }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ message: "Supplier is in use" });
  });

  it("rethrows any other error", () => {
    const error = new Error("database exploded");

    expect(() => handleDeleteError(error, response())).toThrow(error);
  });
});
