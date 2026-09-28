'use strict';

const passport = require('passport');
const xssec = require('@sap/xssec');

/**
 * Reads the bound XSUAA credentials from VCAP_SERVICES.
 * Returns null when no xsuaa service is bound (e.g. local dev without auth).
 */
function readXsuaaCredentials() {
  const vcap = process.env.VCAP_SERVICES;
  if (!vcap) return null;
  try {
    const parsed = JSON.parse(vcap);
    const xsuaa = parsed.xsuaa && parsed.xsuaa[0];
    return xsuaa && xsuaa.credentials ? xsuaa.credentials : null;
  } catch (err) {
    console.error('Failed to parse VCAP_SERVICES for xsuaa:', err.message);
    return null;
  }
}

/**
 * Builds an Express middleware that authenticates the incoming JWT against
 * XSUAA and enforces the Read scope. Uses @sap/xssec's passport strategy.
 *
 * @param {object} [opts]
 * @param {object} [opts.credentials] - XSUAA credentials (defaults to VCAP)
 * @returns {Function|null} middleware, or null when no credentials are available
 */
function createAuthMiddleware(opts = {}) {
  const credentials = opts.credentials || readXsuaaCredentials();
  if (!credentials) {
    return null;
  }

  const xsuaaService = new xssec.XsuaaService(credentials);
  const strategy = new xssec.XssecPassportStrategy(xsuaaService);
  passport.use(strategy);

  const authenticate = passport.authenticate(strategy.name, { session: false });
  const requiredScope = `${credentials.xsappname}.Read`;

  return function authMiddleware(req, res, next) {
    authenticate(req, res, (err) => {
      if (err) {
        console.error('Authentication error:', err.message);
        return res.status(401).json({ error: 'unauthorized' });
      }
      const ctx = req.securityContext;
      if (!ctx) {
        return res.status(401).json({ error: 'unauthorized' });
      }
      // Enforce the Read scope (authorization).
      const token = ctx.token;
      const hasScope =
        typeof token.hasLocalScope === 'function'
          ? token.hasLocalScope('Read')
          : token.getScopes && token.getScopes().includes(requiredScope);
      if (!hasScope) {
        return res.status(403).json({ error: 'forbidden: missing Read scope' });
      }
      next();
    });
  };
}

module.exports = { createAuthMiddleware, readXsuaaCredentials };
