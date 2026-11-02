const { createOrderStatusService } = require("./service");

/**
 * Builds a repository double storing statuses in memory.
 * @param {object[]} [statuses] - Initial catalog.
 * @returns {object} The repository double and its calls.
 */
function createRepositoryDouble(statuses = []) {
  const rows = statuses.map((status) => ({
    description: null,
    is_system: false,
    next_status_code: null,
    ...status,
    update: jest.fn(async function update(values) {
      Object.assign(this, values);
      return this;
    }),
    destroy: jest.fn(async () => undefined),
  }));
  const calls = { created: null, destroyed: [] };

  return {
    rows,
    calls,
    transaction: jest.fn(async (callback) => callback({})),
    findAll: jest.fn(async () => rows),
    findById: jest.fn(
      async (id) => rows.find((row) => row.id === Number(id)) ?? null,
    ),
    findByCode: jest.fn(
      async (code) => rows.find((row) => row.code === code) ?? null,
    ),
    create: jest.fn(async (values) => {
      calls.created = values;
      return { id: 99, ...values };
    }),
    isInUse: jest.fn(async () => false),
    countCodes: jest.fn(
      async (codes) => rows.filter((row) => codes.includes(row.code)).length,
    ),
    remove: jest.fn(async (row) => {
      calls.destroyed.push(row.id);
    }),
  };
}

const BASE = Object.freeze([
  {
    id: 1,
    code: "draft",
    sort_order: 10,
    next_status_code: "request",
    is_system: true,
  },
  {
    id: 2,
    code: "request",
    sort_order: 20,
    next_status_code: "generate",
    is_system: true,
  },
  {
    id: 3,
    code: "generate",
    sort_order: 30,
    next_status_code: "invoiced",
    is_system: true,
  },
  {
    id: 4,
    code: "invoiced",
    sort_order: 40,
    next_status_code: null,
    is_system: true,
  },
  {
    id: 5,
    code: "cancelled",
    sort_order: 50,
    next_status_code: null,
    is_system: true,
  },
]);

describe("order status service", () => {
  it("creates an additional status as non-system", async () => {
    const repository = createRepositoryDouble(BASE);
    const service = createOrderStatusService({ repository });

    const result = await service.create({
      code: "on_hold",
      name: "En espera",
      sort_order: 25,
      next_status_code: "generate",
    });

    expect(repository.calls.created).toEqual({
      code: "on_hold",
      name: "En espera",
      description: null,
      sort_order: 25,
      next_status_code: "generate",
      is_system: false,
    });
    expect(result).toMatchObject({ id: 99, code: "on_hold" });
  });

  it("rejects an unknown next status and a self reference", async () => {
    const repository = createRepositoryDouble(BASE);
    const service = createOrderStatusService({ repository });

    await expect(
      service.create({
        code: "on_hold",
        name: "En espera",
        sort_order: 25,
        next_status_code: "missing",
      }),
    ).rejects.toMatchObject({
      status: 422,
      body: { errors: { next_status_code: "Invalid next status" } },
    });

    await expect(
      service.update(1, { next_status_code: "draft" }),
    ).rejects.toMatchObject({
      status: 422,
      body: {
        errors: { next_status_code: "Next status cannot be the same" },
      },
    });
  });

  it("rejects a transition that would create a cycle", async () => {
    const repository = createRepositoryDouble([
      ...BASE,
      {
        id: 6,
        code: "on_hold",
        sort_order: 25,
        next_status_code: "generate",
        is_system: false,
      },
    ]);
    const service = createOrderStatusService({ repository });

    await expect(
      service.update(3, { next_status_code: "on_hold" }),
    ).rejects.toMatchObject({
      status: 422,
      body: {
        errors: { next_status_code: "Status transition creates a cycle" },
      },
    });
  });

  it("keeps code and is_system immutable when updating", async () => {
    const repository = createRepositoryDouble(BASE);
    const service = createOrderStatusService({ repository });

    await service.update(1, {
      code: "changed",
      is_system: false,
      name: "Nuevo",
    });

    const row = repository.rows.find((status) => status.id === 1);
    expect(row.code).toBe("draft");
    expect(row.is_system).toBe(true);
    expect(row.name).toBe("Nuevo");
  });

  it("rejects deleting a system status, an in-use status and accepts a free one", async () => {
    const repository = createRepositoryDouble([
      ...BASE,
      {
        id: 6,
        code: "on_hold",
        sort_order: 25,
        next_status_code: null,
        is_system: false,
      },
    ]);
    const service = createOrderStatusService({ repository });

    await expect(service.remove(1)).rejects.toMatchObject({
      status: 409,
      body: { message: "System order status cannot be deleted" },
    });

    repository.isInUse.mockResolvedValueOnce(true);
    await expect(service.remove(6)).rejects.toMatchObject({
      status: 409,
      body: { message: "Order status is in use" },
    });

    await service.remove(6);
    expect(repository.calls.destroyed).toEqual([6]);
  });

  it("answers 404 for an unknown status", async () => {
    const service = createOrderStatusService({
      repository: createRepositoryDouble(BASE),
    });

    await expect(service.get(999)).rejects.toMatchObject({
      status: 404,
      body: { message: "Order status not found" },
    });
  });

  it("detects an incomplete base configuration", async () => {
    const service = createOrderStatusService({
      repository: createRepositoryDouble(BASE.slice(0, 2)),
    });

    await expect(service.assertComplete()).rejects.toMatchObject({
      status: 503,
      body: { message: "Order status configuration is incomplete" },
    });
  });
});
