const express = require("express");
const request = require("supertest");
const notFound = require("./not-found");

describe("not-found middleware", () => {
  it("responds 404 as JSON with a generic message", async () => {
    const app = express();
    app.use(notFound);

    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.headers["content-type"]).toMatch(/application\/json/);
    expect(response.body).toEqual({ message: "Not found" });
  });
});
