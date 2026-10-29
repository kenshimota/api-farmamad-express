const {
  as,
  repository,
  resetDoubles,
  storedAssignment,
  tokenFor,
} = require("./customer-sellers-support");

beforeEach(resetDoubles);

describe("POST /customer-sellers", () => {
  it("allows an admin to assign any seller and answers 201", async () => {
    const response = await as("post", "/customer-sellers", tokenFor()).send({
      customer_id: 8,
      seller_id: 12,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual(storedAssignment());
    expect(response.body).not.toHaveProperty("createdAt");
    expect(repository.create).toHaveBeenCalledWith(
      { customer_id: 8, seller_id: 12 },
      { transaction: "tx" },
    );
  });

  it("allows a seller to assign only themselves", async () => {
    const response = await as(
      "post",
      "/customer-sellers",
      tokenFor(12, "seller"),
    ).send({ customer_id: 8, seller_id: 12 });

    expect(response.status).toBe(201);
  });

  it("responds 403 when a seller assigns another seller", async () => {
    const response = await as(
      "post",
      "/customer-sellers",
      tokenFor(12, "seller"),
    ).send({ customer_id: 8, seller_id: 15 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("ignores a client supplied assigned_at", async () => {
    await as("post", "/customer-sellers", tokenFor()).send({
      customer_id: 8,
      seller_id: 12,
      assigned_at: "2020-01-01T00:00:00.000Z",
    });

    expect(repository.create).toHaveBeenCalledWith(
      { customer_id: 8, seller_id: 12 },
      { transaction: "tx" },
    );
  });

  it("responds 400 when required fields are missing", async () => {
    const response = await as("post", "/customer-sellers", tokenFor()).send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      message: "customer_id and seller_id are required",
    });
  });

  it.each([
    [{ customer_id: 8, seller_id: "abc" }, "seller_id"],
    [{ customer_id: 0, seller_id: 12 }, "customer_id"],
  ])("responds 422 for invalid ids in %p", async (body, field) => {
    const response = await as("post", "/customer-sellers", tokenFor()).send(
      body,
    );

    expect(response.status).toBe(422);
    expect(response.body.errors).toHaveProperty(field);
  });

  it.each([
    ["an unknown seller", null],
    ["a user without seller role", { id: 12, role: { name: "admin" } }],
    ["a blocked seller", { id: 12, isBlocked: true, role: { name: "seller" } }],
  ])("responds 422 for %s", async (_label, seller) => {
    repository.findSeller.mockResolvedValue(seller);

    const response = await as("post", "/customer-sellers", tokenFor()).send({
      customer_id: 8,
      seller_id: 12,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { seller_id: "Invalid seller" },
    });
  });

  it("responds 422 for an unknown customer", async () => {
    repository.findCustomer.mockResolvedValue(null);

    const response = await as("post", "/customer-sellers", tokenFor()).send({
      customer_id: 99,
      seller_id: 12,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "Invalid customer" },
    });
  });

  it("responds 409 when the customer already has a seller", async () => {
    repository.findByCustomerId.mockResolvedValue(storedAssignment());

    const response = await as("post", "/customer-sellers", tokenFor()).send({
      customer_id: 8,
      seller_id: 12,
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      message: "Customer already has a seller",
    });
    expect(repository.create).not.toHaveBeenCalled();
  });
});

describe("GET /customer-sellers", () => {
  it("lists every assignment for admin and dispatcher", async () => {
    for (const role of ["admin", "dispatcher"]) {
      const response = await as("get", "/customer-sellers", tokenFor(1, role));

      expect(response.status).toBe(200);
      expect(response.body).toEqual([storedAssignment()]);
    }
  });

  it("filters by customer_id and seller_id", async () => {
    await as("get", "/customer-sellers?customer_id=8&seller_id=12", tokenFor());

    expect(repository.list).toHaveBeenCalledWith({
      customerId: 8,
      sellerId: 12,
    });
  });

  it("forces a seller to see only their own assignments", async () => {
    const response = await as(
      "get",
      "/customer-sellers",
      tokenFor(12, "seller"),
    );

    expect(response.status).toBe(200);
    expect(repository.list).toHaveBeenCalledWith({ sellerId: 12 });
  });

  it("answers 403 when a seller filters by another seller", async () => {
    const response = await as(
      "get",
      "/customer-sellers?seller_id=15",
      tokenFor(12, "seller"),
    );

    expect(response.status).toBe(403);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it("returns an empty array when a customer has no assignment", async () => {
    repository.list.mockResolvedValue([]);

    const response = await as(
      "get",
      "/customer-sellers?customer_id=99",
      tokenFor(),
    );

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it.each(["manager_warehouse", "support", "customer"])(
    "responds 403 for a %s",
    async (role) => {
      const response = await as("get", "/customer-sellers", tokenFor(1, role));

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: "Forbidden" });
    },
  );

  it("responds 401 without a token", async () => {
    const response = await as("get", "/customer-sellers", null);

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
