jest.mock("./database", () => ({
  authenticate: jest.fn().mockResolvedValue(),
}));

const request = require("supertest");
const app = require("./app");

describe("app", () => {
  it("exposes GET /hello-world", async () => {
    const response = await request(app).get("/hello-world");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Hello World" });
  });

  it("exposes GET /health", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "up" });
  });
});
