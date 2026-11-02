const request = require("supertest");
const app = require("../../src/app");

/**
 * Sends an authenticated request.
 * @param {string} method - HTTP method in lowercase.
 * @param {string} path - Request path.
 * @param {string} token - Bearer token.
 * @returns {import("supertest").Test} The supertest request.
 */
function as(method, path, token) {
  return request(app)[method](path).set("Authorization", `Bearer ${token}`);
}

/**
 * Registers a payment through the API without changing its status.
 * @param {object} fixture - Fixture returned by buildFixture.
 * @param {object} [overrides] - Payment body overrides.
 * @param {string} [token] - Token to use; seller by default.
 * @returns {Promise<import("supertest").Response>} The response.
 */
function createPendingPayment(
  fixture,
  overrides = {},
  token = fixture.sellerToken,
) {
  return as("post", "/payments", token).send({
    customer_id: fixture.customer.id,
    method_payment_id: fixture.method.id,
    amount: 100,
    ...overrides,
  });
}

/**
 * Changes the status of a payment through the API.
 * @param {object} fixture - Fixture returned by buildFixture.
 * @param {number} id - Payment id.
 * @param {object} body - Status payload.
 * @param {string} [token] - Token to use; seller by default.
 * @returns {Promise<import("supertest").Response>} The response.
 */
function changeStatus(fixture, id, body, token = fixture.sellerToken) {
  return as("put", `/payments/${id}/status`, token).send(body);
}

/**
 * Registers and conciliates a payment through the API. Existing suites use it
 * as the fixture that produces a wallet deposit; HU-47 tests use
 * `createPendingPayment` to assert the pending behaviour.
 * @param {object} fixture - Fixture returned by buildFixture.
 * @param {object} [overrides] - Payment body overrides.
 * @param {string} [token] - Token to use; seller by default.
 * @returns {Promise<import("supertest").Response>} The creation response with
 *   the wallet attached after conciliation.
 */
async function createPayment(
  fixture,
  overrides = {},
  token = fixture.sellerToken,
) {
  const response = await createPendingPayment(fixture, overrides, token);

  if (response.status !== 201) {
    return response;
  }

  const conciliated = await changeStatus(
    fixture,
    response.body.id,
    { status: "conciliated" },
    token,
  );

  if (conciliated.status !== 202) {
    throw new Error(
      `Unable to conciliate payment ${response.body.id}: ${
        conciliated.body?.message ?? conciliated.status
      }`,
    );
  }

  response.body = {
    ...response.body,
    status: conciliated.body.status,
    status_name: conciliated.body.status_name,
    wallet: conciliated.body.wallet,
  };

  return response;
}

module.exports = {
  as,
  changeStatus,
  createPayment,
  createPendingPayment,
};
