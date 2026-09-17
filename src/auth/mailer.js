const nodemailer = require("nodemailer");
const { getProductName, getProductUrl } = require("../config/product");
const { buildRecoveryBody, buildWelcomeBody } = require("./email-templates");

/**
 * Error thrown when a product email cannot be delivered.
 */
class MailDeliveryError extends Error {
  /**
   * @param {string} message - Error description.
   * @param {Error} [cause] - Original nodemailer error.
   */
  constructor(message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = "MailDeliveryError";
  }
}

let transport = null;

/**
 * Builds the Gmail transport lazily using GMAIL_USERNAME and GMAIL_TOKEN.
 * @returns {import("nodemailer").Transporter} The configured transport.
 */
function getTransport() {
  if (!transport) {
    transport = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.GMAIL_USERNAME,
        pass: process.env.GMAIL_TOKEN,
      },
    });
  }

  return transport;
}

/**
 * Replaces the transport; used by tests to avoid real SMTP traffic.
 * @param {object} next - Transport replacement.
 * @returns {void}
 */
function setTransport(next) {
  transport = next;
}

/**
 * Discards the current transport so the next send builds a new one.
 * @returns {void}
 */
function resetTransport() {
  transport = null;
}

/**
 * Delivers a message through the current transport, wrapping any transport
 * error in a {@link MailDeliveryError}.
 * @param {{ to: string, subject: string, text: string }} message - Message to deliver.
 * @param {string} failureMessage - Error message to expose when delivery fails.
 * @returns {Promise<void>}
 * @throws {MailDeliveryError} When the transport cannot deliver the message.
 */
async function deliver(message, failureMessage) {
  try {
    await getTransport().sendMail({
      from: process.env.GMAIL_USERNAME,
      ...message,
    });
  } catch (error) {
    throw new MailDeliveryError(failureMessage, error);
  }
}

/**
 * Sends the recovery code to the given email through Gmail.
 * @param {string} email - Recipient address.
 * @param {string} code - Plain 8-digit recovery code.
 * @returns {Promise<void>}
 * @throws {MailDeliveryError} When the transport cannot deliver the message.
 */
async function sendRecoveryCode(email, code) {
  const productName = getProductName();

  return deliver(
    {
      to: email,
      subject: `Recuperación de contraseña - ${productName}`,
      text: buildRecoveryBody(code, productName),
    },
    "Could not send the recovery email",
  );
}

/**
 * Sends the welcome email to a newly created user through Gmail.
 * @param {string} email - Recipient address.
 * @param {string|null|undefined} name - User name, used in the greeting.
 * @returns {Promise<void>}
 * @throws {MailDeliveryError} When the transport cannot deliver the message.
 */
async function sendWelcomeEmail(email, name) {
  const productName = getProductName();
  const productUrl = getProductUrl();

  return deliver(
    {
      to: email,
      subject: `¡Bienvenido a ${productName}!`,
      text: buildWelcomeBody(name, productName, productUrl),
    },
    "Could not send the welcome email",
  );
}

module.exports = {
  MailDeliveryError,
  getTransport,
  setTransport,
  resetTransport,
  sendRecoveryCode,
  sendWelcomeEmail,
};
