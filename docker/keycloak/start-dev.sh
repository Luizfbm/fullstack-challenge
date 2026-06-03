#!/bin/sh
set -eu

/opt/keycloak/bin/kc.sh start-dev --import-realm &
keycloak_pid="$!"

cleanup() {
  if kill -0 "$keycloak_pid" 2>/dev/null; then
    kill "$keycloak_pid" 2>/dev/null || true
    wait "$keycloak_pid" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

attempts=0
until /opt/keycloak/bin/kcadm.sh config credentials \
  --server http://localhost:8080 \
  --realm master \
  --user "${KC_BOOTSTRAP_ADMIN_USERNAME:-admin}" \
  --password "${KC_BOOTSTRAP_ADMIN_PASSWORD:-admin}" \
  >/tmp/keycloak-admin-login.log 2>&1; do
  attempts=$((attempts + 1))

  if [ "$attempts" -ge 60 ]; then
    cat /tmp/keycloak-admin-login.log
    exit 1
  fi

  sleep 1
done

attempts=0
until /opt/keycloak/bin/kcadm.sh update realms/master -s sslRequired=none \
  >/tmp/keycloak-master-realm-update.log 2>&1; do
  attempts=$((attempts + 1))

  if [ "$attempts" -ge 30 ]; then
    cat /tmp/keycloak-master-realm-update.log
    exit 1
  fi

  sleep 1
done

echo "Configured Keycloak master realm for local HTTP admin access"

wait "$keycloak_pid"
