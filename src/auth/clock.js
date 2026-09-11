let provider = () => new Date();

/**
 * Returns the current date using the configured clock. Tests replace the
 * provider to travel in time without waiting.
 * @returns {Date} The current date.
 */
function now() {
  return provider();
}

/**
 * Replaces the clock provider.
 * @param {() => Date} next - Function returning the current date.
 * @returns {void}
 */
function setClock(next) {
  provider = next;
}

/**
 * Restores the real system clock.
 * @returns {void}
 */
function resetClock() {
  provider = () => new Date();
}

module.exports = { now, setClock, resetClock };
