/**
 * Debug helper module that overrides console.log globally
 * to respect a global debug flag
 */

// Global debug flag
let globalDebug = false;

// Store original console methods
const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug
};

/**
 * Set the global debug flag
 * @param {boolean} value - The new debug value
 */
export function setDebug(value) {
    globalDebug = value;
}

/**
 * Get the current debug flag value
 * @returns {boolean} The current debug value
 */
export function getDebug() {
    return globalDebug;
}

/**
 * Override console methods to respect debug flag
 */
console.log = (...args) => {
    if (globalDebug) {
        originalConsole.log(...args);
    }
};

console.warn = (...args) => {
    if (globalDebug) {
        originalConsole.warn(...args);
    }
};

console.info = (...args) => {
    if (globalDebug) {
        originalConsole.info(...args);
    }
};

console.debug = (...args) => {
    if (globalDebug) {
        originalConsole.debug(...args);
    }
};

// Don't override console.error as errors should always be shown
// console.error remains unchanged 