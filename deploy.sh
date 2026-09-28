#!/usr/bin/env bash
#
# Deploys the BFF (web + internal api) to Cloud Foundry on the SAP BTP trial.
#
# Prerequisites:
#   - cf CLI v8+ installed and logged in:
#       cf login -a https://api.cf.us10-001.hana.ondemand.com
#       (org: efbc829etrial, space: dev)
#   - HANA Cloud instance running (see HANA section below).
#
# Usage:
#   ./deploy.sh
#
set -euo pipefail

API_APP="bff-api"
WEB_APP="bff-web"
INTERNAL_HOST="bff-api"                 # -> bff-api.apps.internal
HANA_SERVICE="bff-hana"
XSUAA_SERVICE="bff-xsuaa"
LOGS_SERVICE="bff-logs"

echo "==> 1/6 Creating backing services (idempotent)"

# XSUAA using the security descriptor.
cf create-service xsuaa application "$XSUAA_SERVICE" -c xs-security.json || true

# Application Logging (native logging, lite plan on trial).
cf create-service application-logs lite "$LOGS_SERVICE" || true

# HANA Cloud HDI container. Requires a running HANA Cloud instance in the
# space. On the trial the plan is usually 'hdi-shared' backed by hana-free.
cf create-service hana hdi-shared "$HANA_SERVICE" || true

echo "==> 2/6 Waiting for services to be ready"
for svc in "$XSUAA_SERVICE" "$LOGS_SERVICE" "$HANA_SERVICE"; do
  echo "    - $svc"
  # Poll until creation succeeds (or fails).
  while true; do
    status=$(cf service "$svc" | awk -F': *' '/status:/ {print $2; exit}')
    case "$status" in
      *succeeded*) echo "      ready"; break ;;
      *failed*)    echo "      FAILED"; cf service "$svc"; exit 1 ;;
      *)           sleep 10 ;;
    esac
  done
done

echo "==> 3/6 Pushing apps (no start yet, so we can wire the internal route first)"
cf push -f manifest.yml --no-start

echo "==> 4/6 Mapping internal route for the API and opening network policy"
# Internal route: only reachable from other apps in the foundation.
cf map-route "$API_APP" apps.internal --hostname "$INTERNAL_HOST" || true
# Allow the web app to reach the api over the internal network on port 8080.
cf add-network-policy "$WEB_APP" "$API_APP" --protocol tcp --port 8080 || true

echo "==> 5/6 Starting apps"
cf start "$API_APP"
cf start "$WEB_APP"

echo "==> 6/6 Done. Public URL of the web app:"
cf app "$WEB_APP" | awk -F': *' '/routes:/ {print "    https://" $2}'

cat <<'NOTE'

Next manual step (one-time):
  Assign the role collection 'BFFViewer' to your trial user:
    BTP Cockpit -> Security -> Role Collections -> BFFViewer -> add your user
  Then open the web app URL, log in via Cloud Identity Services, and use the app.
NOTE
