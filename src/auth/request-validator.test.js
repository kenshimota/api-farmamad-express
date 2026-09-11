const express = require("express");
const request = require("supertest");
const yup = require("yup");
const { validateRequest } = require("./request-validator");

const schema = yup.object({
  email: yup.string().trim().email("Email inválido"),
});
const FIELDS = ["email"];

const app = express();
app.use(express.json());
app.post("/resource", validateRequest({ schema, fields: FIELDS }), (req, res) =>
  res.json({ validated: req.validated }),
);

const post = (body) => request(app).post("/resource").send(body);

describe("validateRequest", () => {
  it("responds 400 listing every required field when there is no body", async () => {
    const response = await request(app).post("/resource");

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "email is required" });
  });

  it("responds 400 when a required field is empty", async () => {
    const response = await post({ email: "" });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ message: "email is required" });
  });

  it("responds 422 with the flattened yup errors", async () => {
    const response = await post({ email: "invalid@" });

    expect(response.status).toBe(422);
    expect(response.body).toEqual({ errors: { email: "Email inválido" } });
  });

  it("exposes the trimmed data without unknown fields as req.validated", async () => {
    const response = await post({ email: "  juan@example.com  ", extra: 1 });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ validated: { email: "juan@example.com" } });
  });
});
