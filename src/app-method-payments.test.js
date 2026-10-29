process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const app = require("./app");

describe("method payments routing", () => {
  it("exposes GET /method-payments behind authentication", async () => {
    const response = await request(app).get("/method-payments");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
