process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const request = require("supertest");
const app = require("./app");

describe("shelves routing", () => {
  it("exposes GET /shelves behind authentication", async () => {
    const response = await request(app).get("/shelves");

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ message: "Unauthorized" });
  });
});
