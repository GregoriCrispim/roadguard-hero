#!/usr/bin/env bash
set -euo pipefail

# Requires: SUPABASE_ACCESS_TOKEN (from https://supabase.com/dashboard/account/tokens)

PROJECT_REF="gxhlbiyflpzhhwiqhldr"
VERCEL_PROD_URL="https://roadguard-hero.vercel.app"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "ERROR: Set SUPABASE_ACCESS_TOKEN before running." >&2
  exit 1
fi

echo "==> Pushing auth config from supabase/config.toml"
npx supabase config push --project-ref "$PROJECT_REF" --yes

echo "==> Updating auth redirect URLs via Management API"
curl -fsS -X PATCH "https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth" \
  -H "Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$(jq -n \
    --arg site "$VERCEL_PROD_URL" \
  '{
    site_url: $site,
    uri_allow_list: [
      ($site + "/**"),
      ($site + "/app"),
      ($site + "/auth"),
      "http://localhost:8080/**",
      "http://localhost:8080/app",
      "http://localhost:8080/auth"
    ] | join(",")
  }')" | jq '{site_url, uri_allow_list}'

echo "==> Fetching API keys"
SERVICE_ROLE_KEY="$(npx supabase projects api-keys --project-ref "$PROJECT_REF" -o json \
  | jq -r '.[] | select(.name == "service_role") | .api_key')"

if [[ -z "$SERVICE_ROLE_KEY" || "$SERVICE_ROLE_KEY" == "null" ]]; then
  echo "ERROR: Could not retrieve service_role key." >&2
  exit 1
fi

echo "==> Adding SUPABASE_SERVICE_ROLE_KEY to Vercel (production)"
timeout 60 npx vercel env add SUPABASE_SERVICE_ROLE_KEY production \
  --value "$SERVICE_ROLE_KEY" --yes --sensitive --non-interactive || true

if [[ -n "${GOOGLE_GENERATIVE_AI_API_KEY:-}" ]]; then
  echo "==> Adding GOOGLE_GENERATIVE_AI_API_KEY to Vercel (production)"
  timeout 60 npx vercel env add GOOGLE_GENERATIVE_AI_API_KEY production \
    --value "$GOOGLE_GENERATIVE_AI_API_KEY" --yes --sensitive --non-interactive || true
fi

echo "==> Redeploying Vercel production"
timeout 300 npx vercel --prod --yes --non-interactive

echo "==> Done. Verify: ${VERCEL_PROD_URL}/auth"
