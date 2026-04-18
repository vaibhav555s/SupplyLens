// ─── HTTP Client with Retry, Rate Limiting, Backoff ───

const axios = require('axios');
const config = require('../config');

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Per-source last-request timestamps for rate limiting
const lastRequestTime = {};

/**
 * Rate-limited, retrying HTTP GET.
 *
 * @param {string} url
 * @param {object} options
 * @param {string} options.source - Source identifier for rate limiting (e.g. 'importyeti')
 * @param {object} [options.params] - Query parameters
 * @param {object} [options.headers] - Extra headers
 * @param {number} [options.maxRetries] - Override default max retries
 * @param {number} [options.timeout] - Request timeout in ms (default 30s)
 * @returns {Promise<any>} Response data
 */
async function httpGet(url, options = {}) {
    const {
        source = 'default',
        params = {},
        headers = {},
        maxRetries = config.retry.maxRetries,
        timeout = 30000,
    } = options;

    // Rate limiting
    const rateLimit = config.rateLimits[source] || 0;
    if (rateLimit > 0) {
        const now = Date.now();
        const lastTime = lastRequestTime[source] || 0;
        const elapsed = now - lastTime;
        if (elapsed < rateLimit) {
            await sleep(rateLimit - elapsed);
        }
    }

    // Retry loop with exponential backoff
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            lastRequestTime[source] = Date.now();

            const response = await axios.get(url, {
                params,
                headers: {
                    'User-Agent': 'SupplyChainXRay/1.0 (research; contact@supplychainxray.com)',
                    'Accept': 'application/json, text/html',
                    ...headers,
                },
                timeout,
                validateStatus: (status) => status < 500, // only retry on 5xx
            });

            // Handle rate limiting
            if (response.status === 429) {
                const retryAfter = parseInt(response.headers['retry-after'], 10) || 5;
                console.warn(`[HTTP] Rate limited by ${source}, waiting ${retryAfter}s`);
                await sleep(retryAfter * 1000);
                continue;
            }

            if (response.status === 401 || response.status === 403) {
                const e = new Error(`HTTP ${response.status}: ${url}`);
                e.isAuthError = true;
                throw e; // Caught by catch block, but we'll check isAuthError
            }

            if (response.status >= 400) {
                throw new Error(`HTTP ${response.status}: ${url}`);
            }

            return response.data;
        } catch (err) {
            lastError = err;
            if (err.isAuthError) {
                break; // Do not retry on 401/403
            }
            if (attempt < maxRetries) {
                const delay = config.retry.baseDelay * Math.pow(2, attempt);
                console.warn(`[HTTP] ${source} attempt ${attempt + 1} failed, retrying in ${delay}ms: ${err.message}`);
                await sleep(delay);
            }
        }
    }

    throw new Error(`[HTTP] ${source} failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Rate-limited, retrying HTTP POST.
 */
async function httpPost(url, data, options = {}) {
    const {
        source = 'default',
        headers = {},
        maxRetries = config.retry.maxRetries,
        timeout = 30000,
    } = options;

    const rateLimit = config.rateLimits[source] || 0;
    if (rateLimit > 0) {
        const now = Date.now();
        const lastTime = lastRequestTime[source] || 0;
        const elapsed = now - lastTime;
        if (elapsed < rateLimit) {
            await sleep(rateLimit - elapsed);
        }
    }

    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            lastRequestTime[source] = Date.now();

            const response = await axios.post(url, data, {
                headers: {
                    'User-Agent': 'SupplyChainXRay/1.0 (research; contact@supplychainxray.com)',
                    'Content-Type': 'application/json',
                    ...headers,
                },
                timeout,
            });

            if (response.status === 429) {
                const retryAfter = parseInt(response.headers['retry-after'], 10) || 15;
                console.warn(`[HTTP] Rate limit encountered for ${source}. Waiting ${retryAfter}s before retry...`);
                await sleep(retryAfter * 1000);
                continue;
            }

            if (response.status === 401 || response.status === 403) {
                const e = new Error(`HTTP ${response.status}: ${url}`);
                e.isAuthError = true;
                throw e;
            }

            return response.data;
        } catch (err) {
            lastError = err;
            if (err.isAuthError) {
                break;
            }
            if (attempt < maxRetries) {
                const delay = config.retry.baseDelay * Math.pow(2, attempt);
                await sleep(delay);
            }
        }
    }

    throw new Error(`[HTTP] ${source} POST failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

module.exports = { httpGet, httpPost, sleep };
