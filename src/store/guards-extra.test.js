const {
  CUSTOMER_PRICE_LIST_MESSAGE,
  resolveStoreCustomer,
} = require("./guards");

/**
 * Builds a guard repository double.
 * @param {object} [overrides] - Method overrides.
 * @returns {object} Repository double.
 */
function repositoryDouble(overrides = {}) {
  return {
    isCustomerAssigned: jest.fn().mockResolvedValue(true),
    findCustomer: jest.fn().mockResolvedValue({
      id: 8,
      price_list_id: 4,
      price_list: { id: 4, percentage: "30.00" },
    }),
    ...overrides,
  };
}

describe("resolveStoreCustomer staff and seller paths", () => {
  it("resolves any customer for an administrator", async () => {
    const repository = repositoryDouble();

    const context = await resolveStoreCustomer({
      user: { id: 1, role: { name: "admin" } },
      requestedCustomerId: "8",
      repository,
    });

    expect(context.customerId).toBe(8);
    expect(context.priceList.id).toBe(4);
    expect(repository.isCustomerAssigned).not.toHaveBeenCalled();
  });

  it("resolves an assigned customer for a seller", async () => {
    const repository = repositoryDouble();

    const context = await resolveStoreCustomer({
      user: { id: 2, role: { name: "seller" } },
      requestedCustomerId: 8,
      repository,
    });

    expect(context.customerId).toBe(8);
    expect(repository.isCustomerAssigned).toHaveBeenCalledWith(8, 2);
  });

  it("rejects an invalid customer_id from a customer with 403", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 10, customer_id: 8, role: { name: "customer" } },
        requestedCustomerId: "abc",
        repository: repositoryDouble(),
      }),
    ).rejects.toMatchObject({ status: 403, body: { message: "Forbidden" } });
  });

  it("rejects an invalid customer_id from staff with 400", async () => {
    await expect(
      resolveStoreCustomer({
        user: { id: 2, role: { name: "seller" } },
        requestedCustomerId: "abc",
        repository: repositoryDouble(),
      }),
    ).rejects.toMatchObject({
      status: 400,
      body: { message: "customer_id is required" },
    });
  });

  it("uses the price list id when the nested relation is not loaded", async () => {
    const context = await resolveStoreCustomer({
      user: { id: 10, customer_id: 8, role: { name: "customer" } },
      repository: repositoryDouble({
        findCustomer: jest.fn().mockResolvedValue({
          id: 8,
          price_list_id: 4,
          price_list: null,
        }),
      }),
    });

    expect(context.priceList).toEqual({ id: 4 });
    expect(CUSTOMER_PRICE_LIST_MESSAGE).toBe(
      "Customer price list is not assigned",
    );
  });
});
