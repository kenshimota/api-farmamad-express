const express = require("express");
const request = require("supertest");
const helloRouter = require("./index");

const app = express();
app.use("/hello-world", helloRouter);

describe("GET /hello-world", () => {
  it("responds 200 with the hello world message", async () => {
    const response = await request(app).get("/hello-world");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ message: "Hello World" });
  });
});
