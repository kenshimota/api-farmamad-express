const {
  as,
  repository,
  resetDoubles,
  storedAssignment,
  tokenFor,
} = require("./customer-sellers-support");

beforeEach(resetDoubles);

describe("GET /customer-sellers/:id", () => {
  it("returns the assignment to admin, dispatcher and its seller", async () => {
    for (const [sub, role] of [
      [1, "admin"],
      [2, "dispatcher"],
      [12, "seller"],
    ]) {
      const response = await as(
        "get",
        "/customer-sellers/1",
        tokenFor(sub, role),
      );

      expect(response.status).toBe(200);
      expect(response.body).toEqual(storedAssignment());
    }
  });

  it("responds 403 when a seller reads another seller's assignment", async () => {
    const response = await as(
      "get",
      "/customer-sellers/1",
      tokenFor(15, "seller"),
    );

    expect(response.status).toBe(403);
    expect(response.body).toEqual({ message: "Forbidden" });
  });

  it("responds 404 for an unknown assignment and 422 for an invalid id", async () => {
    repository.findById.mockResolvedValue(null);

    const missing = await as("get", "/customer-sellers/999", tokenFor());
    expect(missing.status).toBe(404);
    expect(missing.body).toEqual({ message: "Assignment not found" });

    const invalid = await as("get", "/customer-sellers/abc", tokenFor());
    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { id: "Invalid assignment id" },
    });
  });
});

describe("PUT /customer-sellers/:id", () => {
  it("allows an admin to reassign and answers 202", async () => {
    const response = await as("put", "/customer-sellers/1", tokenFor()).send({
      seller_id: 15,
    });

    expect(response.status).toBe(202);
    expect(repository.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      { seller_id: 15, assigned_at: expect.any(Date) },
      { transaction: "tx" },
    );
  });

  it("allows a seller to reassign their own assignment to themselves", async () => {
    const response = await as(
      "put",
      "/customer-sellers/1",
      tokenFor(12, "seller"),
    ).send({ seller_id: 12 });

    expect(response.status).toBe(202);
  });

  it("responds 403 when a seller updates another seller's assignment", async () => {
    const response = await as(
      "put",
      "/customer-sellers/1",
      tokenFor(15, "seller"),
    ).send({ seller_id: 15 });

    expect(response.status).toBe(403);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("responds 403 when a seller hands the customer to another seller", async () => {
    const response = await as(
      "put",
      "/customer-sellers/1",
      tokenFor(12, "seller"),
    ).send({ seller_id: 15 });

    expect(response.status).toBe(403);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("responds 400 when seller_id is missing", async () => {
    const response = await as("put", "/customer-sellers/1", tokenFor()).send(
      {},
    );

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "seller_id is required" });
  });

  it("rejects a different customer_id with 422", async () => {
    const response = await as("put", "/customer-sellers/1", tokenFor()).send({
      seller_id: 12,
      customer_id: 9,
    });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({
      errors: { customer_id: "customer_id cannot be changed" },
    });
  });

  it("accepts the same customer_id and validates the new seller", async () => {
    const response = await as("put", "/customer-sellers/1", tokenFor()).send({
      seller_id: 15,
      customer_id: 8,
    });
    expect(response.status).toBe(202);

    repository.findSeller.mockResolvedValue({ id: 15, isBlocked: true });
    const invalid = await as("put", "/customer-sellers/1", tokenFor()).send({
      seller_id: 15,
    });

    expect(invalid.status).toBe(422);
    expect(invalid.body).toEqual({
      errors: { seller_id: "Invalid seller" },
    });
  });
});

describe("DELETE /customer-sellers/:id", () => {
  it("allows an admin or the owner seller to delete and answers 204", async () => {
    for (const [sub, role] of [
      [1, "admin"],
      [12, "seller"],
    ]) {
      repository.remove.mockClear();

      const response = await as(
        "delete",
        "/customer-sellers/1",
        tokenFor(sub, role),
      );

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(repository.remove).toHaveBeenCalled();
    }
  });

  it("responds 403 when a seller deletes another seller's assignment", async () => {
    const response = await as(
      "delete",
      "/customer-sellers/1",
      tokenFor(15, "seller"),
    );

    expect(response.status).toBe(403);
    expect(repository.remove).not.toHaveBeenCalled();
  });

  it("responds 404 for an unknown assignment", async () => {
    repository.findById.mockResolvedValue(null);

    const response = await as("delete", "/customer-sellers/999", tokenFor());

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ message: "Assignment not found" });
  });
});
