const { sendWelcomeEmail } = require("./mailer");
const logger = require("../config/logger");

const WELCOME_FAILURE_MESSAGE = "Could not send the welcome email";

/**
 * Notifies a freshly created user by email without letting a delivery failure
 * break the surrounding request.
 *
 * The notification is a best-effort side effect: the caller has already
 * persisted the user, so a broken SMTP connection must never turn a 201 into a
 * 500. Failures are logged and swallowed. The delivery and logging strategies
 * can be overridden, which keeps the policy decoupled from the concrete mailer.
 *
 * @param {{ email: string, name?: string|null }} user - Created user.
 * @param {{ send?: Function, log?: { error: Function } }} [dependencies]
 *   Delivery and logging strategies; defaults to the mailer and app logger.
 * @returns {Promise<void>} Resolves once the attempt (success or failure) ends.
 */
async function notifyWelcomeUser(user, dependencies = {}) {
  const { send = sendWelcomeEmail, log = logger } = dependencies;

  try {
    await send(user.email, user.name);
  } catch (error) {
    log.error(WELCOME_FAILURE_MESSAGE, { email: user.email, error });
  }
}

module.exports = { notifyWelcomeUser };
