'use strict';

/**
 * Resolves the HANA connection configuration.
 *
 * On Cloud Foundry the credentials arrive through VCAP_SERVICES (bound
 * hana / hana-free instance). Locally you can point to a HANA Cloud trial
 * instance using a service key exported as HANA_* environment variables.
 *
 * Returns null when no HANA credentials are available, which lets the
 * server fall back to the in-memory repository (useful for local runs
 * and tests without a real database).
 */
function resolveHanaCredentials() {
  // 1) Explicit env vars (local dev with a service key)
  if (process.env.HANA_HOST && process.env.HANA_USER && process.env.HANA_PASSWORD) {
    return {
      host: process.env.HANA_HOST,
      port: Number(process.env.HANA_PORT || 443),
      user: process.env.HANA_USER,
      password: process.env.HANA_PASSWORD,
      schema: process.env.HANA_SCHEMA,
      // HANA Cloud requires encryption
      encrypt: true,
      sslValidateCertificate: process.env.HANA_SSL_VALIDATE !== 'false',
    };
  }

  // 2) VCAP_SERVICES (Cloud Foundry bound service)
  const vcap = process.env.VCAP_SERVICES;
  if (vcap) {
    try {
      const parsed = JSON.parse(vcap);
      const candidates = [
        ...(parsed.hana || []),
        ...(parsed['hana-cloud'] || []),
        ...(parsed['hana-free'] || []),
      ];
      const instance = candidates.find((c) => c && c.credentials);
      if (instance) {
        const c = instance.credentials;
        return {
          host: c.host,
          port: Number(c.port || 443),
          // HDI containers expose the runtime SQL user as user/password.
          user: c.user,
          password: c.password,
          // HDI containers place objects in a dedicated schema; when present
          // we scope all statements to it.
          schema: c.schema,
          encrypt: true,
          sslValidateCertificate: c.certificate ? true : true,
        };
      }
    } catch (err) {
      console.error('Failed to parse VCAP_SERVICES:', err.message);
    }
  }

  return null;
}

const config = {
  port: Number(process.env.PORT || 4001),
  tableName: process.env.HANA_TABLE || 'ITEMS',
  hana: resolveHanaCredentials(),
};

module.exports = { config, resolveHanaCredentials };
