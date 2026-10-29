process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const app = require("./app");

describe("lots routing", () => {
  it("exposes GET /lots behind authentication", async () => {
    const response = await request(app).get("/lots");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
