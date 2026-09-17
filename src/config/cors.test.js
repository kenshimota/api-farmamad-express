const express = require("express");
const request = require("supertest");
const cors = require("./cors");

const ORIGINAL_CORS_ORIGIN = process.env.CORS_ORIGIN;

/**
 * Builds a tiny app with the CORS middleware, one route per method and the
 * same JSON 404 used by the API.
 *
 * @returns {import("express").Express}
 */
function buildApp() {
  const app = express();
  app.use(cors);
  app.get("/items", (req, res) => res.json({ items: [] }));
  app.post("/items", (req, res) => res.status(201).json({ created: true }));
  app.get("/items/:id", (req, res) => res.json({ id: req.params.id }));
  app.use((req, res) => res.status(404).json({ message: "Not found" }));
  return app;
}

describe("cors middleware", () => {
  beforeEach(() => {
    delete process.env.CORS_ORIGIN;
  });

  afterAll(() => {
    if (ORIGINAL_CORS_ORIGIN === undefined) {
      delete process.env.CORS_ORIGIN;
    } else {
      process.env.CORS_ORIGIN = ORIGINAL_CORS_ORIGIN;
    }
  });

  describe("origin policy", () => {
    it("allows every origin by default", async () => {
      const response = await request(buildApp())
        .get("/items")
        .set("Origin", "http://localhost:5173");

      expect(response.headers["access-control-allow-origin"]).toBe("*");
    });

    it("treats an empty CORS_ORIGIN as the wildcard default", async () => {
      process.env.CORS_ORIGIN = "   ";

      const response = await request(buildApp()).get("/items");

      expect(response.headers["access-control-allow-origin"]).toBe("*");
    });

    it("treats a CORS_ORIGIN with only separators as the wildcard default", async () => {
      process.env.CORS_ORIGIN = " , ";

      const response = await request(buildApp()).get("/items");

      expect(response.headers["access-control-allow-origin"]).toBe("*");
    });

    it("appends Origin to an existing Vary header", async () => {
      process.env.CORS_ORIGIN = "https://app.superking.com";
      const app = express();
      app.use((req, res, next) => {
        res.setHeader("Vary", "Accept-Encoding");
        next();
      });
      app.use(cors);
      app.get("/items", (req, res) => res.json({ items: [] }));
      app.use((req, res) => res.status(404).json({ message: "Not found" }));

      const response = await request(app).get("/items");

      expect(response.headers.vary).toBe("Accept-Encoding, Origin");
    });

    it("does not duplicate Origin in the Vary header", async () => {
      process.env.CORS_ORIGIN = "https://app.superking.com";
      const app = express();
      app.use((req, res, next) => {
        res.setHeader("Vary", "Origin");
        next();
      });
      app.use(cors);
      app.get("/items", (req, res) => res.json({ items: [] }));
      app.use((req, res) => res.status(404).json({ message: "Not found" }));

      const response = await request(app).get("/items");

      expect(response.headers.vary).toBe("Origin");
    });

    it("echoes the request origin when it is part of the configured list", async () => {
      process.env.CORS_ORIGIN =
        "https://app.superking.com, https://admin.superking.com";

      const response = await request(buildApp())
        .get("/items")
        .set("Origin", "https://admin.superking.com");

      expect(response.headers["access-control-allow-origin"]).toBe(
        "https://admin.superking.com",
      );
      expect(response.headers.vary).toBe("Origin");
    });

    it("does not allow origins outside the configured list", async () => {
      process.env.CORS_ORIGIN = "https://app.superking.com";

      const response = await request(buildApp())
        .get("/items")
        .set("Origin", "https://evil.example.com");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(response.headers.vary).toBe("Origin");
    });

    it("does not set an allow-origin header when the request has no Origin", async () => {
      process.env.CORS_ORIGIN = "https://app.superking.com";

      const response = await request(buildApp()).get("/items");

      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    });
  });

  describe("exposed headers", () => {
    it("exposes only X-Request-Id", async () => {
      const response = await request(buildApp()).get("/items");

      expect(response.headers["access-control-expose-headers"]).toBe(
        "X-Request-Id",
      );
      expect(response.headers["access-control-expose-headers"]).not.toMatch(
        /authorization|set-cookie/i,
      );
    });

    it("never enables credentials", async () => {
      const response = await request(buildApp())
        .get("/items")
        .set("Origin", "http://localhost:5173");

      expect(
        response.headers["access-control-allow-credentials"],
      ).toBeUndefined();
    });
  });

  describe("preflight", () => {
    it("answers 204 for an existing route without running its handlers", async () => {
      const handler = jest.fn((req, res) => res.json({ created: true }));
      const app = express();
      app.use(cors);
      app.post("/items", handler);
      app.use((req, res) => res.status(404).json({ message: "Not found" }));

      const response = await request(app)
        .options("/items")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "POST")
        .set("Access-Control-Request-Headers", "authorization,content-type");

      expect(response.status).toBe(204);
      expect(response.text).toBe("");
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.headers["access-control-allow-methods"]).toBe(
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
      expect(response.headers["access-control-allow-headers"]).toBe(
        "Content-Type,Authorization,X-Request-Id",
      );
      expect(response.headers["access-control-max-age"]).toBe("86400");
      expect(handler).not.toHaveBeenCalled();
    });

    it("matches parameterized routes", async () => {
      const response = await request(buildApp()).options("/items/42");

      expect(response.status).toBe(204);
    });

    it("matches routes inside a router mounted at the root", async () => {
      const router = express.Router();
      router.get("/nested", (req, res) => res.json({ ok: true }));
      const app = express();
      app.use(cors);
      app.use(router);
      app.use((req, res) => res.status(404).json({ message: "Not found" }));

      const response = await request(app).options("/nested");

      expect(response.status).toBe(204);
    });

    it("matches routes inside a router mounted on a prefix", async () => {
      const router = express.Router();
      router.post("/", (req, res) => res.json({ ok: true }));
      router.patch("/:id/status", (req, res) => res.json({ ok: true }));
      const app = express();
      app.use(cors);
      app.use("/users", router);
      app.use((req, res) => res.status(404).json({ message: "Not found" }));

      const mounted = await request(app).options("/users");
      const nested = await request(app).options("/users/7/status");
      const unknown = await request(app).options("/users/7/unknown");

      expect(mounted.status).toBe(204);
      expect(nested.status).toBe(204);
      expect(unknown.status).toBe(404);
    });

    it("answers 404 with CORS headers for an unknown route", async () => {
      const response = await request(buildApp()).options("/missing");

      expect(response.status).toBe(404);
      expect(response.headers["content-type"]).toMatch(/application\/json/);
      expect(response.headers["access-control-allow-origin"]).toBe("*");
      expect(response.body).toEqual({ message: "Not found" });
    });

    it("keeps the preflight headers when the origin is not allowed", async () => {
      process.env.CORS_ORIGIN = "https://app.superking.com";

      const response = await request(buildApp())
        .options("/items")
        .set("Origin", "https://evil.example.com");

      expect(response.status).toBe(204);
      expect(response.headers["access-control-allow-origin"]).toBeUndefined();
      expect(response.headers["access-control-allow-methods"]).toBe(
        "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      );
    });
  });

  describe("router introspection fallbacks", () => {
    /**
     * Minimal response double for direct middleware calls.
     *
     * @returns {Object} A fake Express response.
     */
    function buildResponse() {
      const headers = {};
      return {
        setHeader: jest.fn((name, value) => {
          headers[name.toLowerCase()] = value;
        }),
        getHeader: jest.fn((name) => headers[name.toLowerCase()]),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      };
    }

    it("assumes the route exists when the app router is unavailable", () => {
      const req = { method: "OPTIONS", path: "/items", headers: {}, app: {} };
      const res = buildResponse();
      const next = jest.fn();

      cors(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalledTimes(1);
      expect(next).not.toHaveBeenCalled();
    });

    it("falls back to next when the router cannot be inspected", () => {
      const req = {
        method: "OPTIONS",
        path: "/items",
        headers: {},
        app: {
          router: {
            stack: [
              {
                route: {},
                match: () => {
                  throw new Error("boom");
                },
              },
            ],
          },
        },
      };
      const res = buildResponse();
      const next = jest.fn();

      cors(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.end).not.toHaveBeenCalled();
    });
  });
});
