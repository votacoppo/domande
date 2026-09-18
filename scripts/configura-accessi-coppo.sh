#!/usr/bin/env bash
# Raccoglie in un solo incolla i soli accessi necessari al progetto Coppo.
# I valori restano in memoria e vengono passati alla cassaforte del workspace via stdin:
# non finiscono nel repository, nella history della shell o in file temporanei.
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ROOT="$(cd "$PROJECT_ROOT/../../.." && pwd)"
SET_SECRET="$WORKSPACE_ROOT/Costanza-SMM/scripts/security/env-set-secret.sh"

if [ ! -x "$SET_SECRET" ]; then
  echo "ERRORE: gestore sicuro non trovato: $SET_SECRET" >&2
  exit 1
fi

print_template() {
  cat <<'EOF'
Email: votacoppodomande@gmail.com
Pass:

Supabase:
- Database pass:
- Project URL: https://oektjluyukxtqzwhbrbd.supabase.co
- Access Token (scade domani):
- Secret Key:
- Anon public:
- Service Role:

Cloudflare:
- Account ID:
- Your API Token:
- Access Key ID:
- Secret Access Key:
- S3 API Endpoint:

GitHub:
- Repository URL: https://github.com/votacoppo/domande

Vercel:
- User ID:
- AI Gateway API:
- API Token:

Dashboard interna:
- Pass:

FINE_CREDENZIALI
EOF
}

if [ "${1:-}" = "--template" ]; then
  print_template
  exit 0
fi

if [ $# -gt 0 ]; then
  echo "Uso: bash scripts/configura-accessi-coppo.sh [--template]" >&2
  exit 2
fi

ADMIN_DASHBOARD_PASSWORD=""
EMAIL=""
EMAIL_PASSWORD=""
SUPABASE_DB_PASSWORD=""
SUPABASE_URL=""
SUPABASE_ACCESS_TOKEN=""
SUPABASE_SECRET_KEY=""
SUPABASE_ANON_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_API_TOKEN=""
CLOUDFLARE_ACCESS_KEY_ID=""
CLOUDFLARE_SECRET_ACCESS_KEY=""
CLOUDFLARE_S3_ENDPOINT=""
GITHUB_REPO_URL=""
VERCEL_USER_ID=""
VERCEL_AI_GATEWAY_API=""
VERCEL_TOKEN=""
FOUND_END=0
SECTION=""

restore_echo() {
  stty echo < /dev/tty 2>/dev/null || true
}

echo "Copia il modello, compilalo e incollalo qui tutto insieme."
echo "Durante l'incolla non comparirà nulla sullo schermo."
echo "Il marker FINE_CREDENZIALI chiude il blocco."
echo
print_template
echo
printf 'Incolla ora il blocco compilato: '

exec 3</dev/tty
trap restore_echo EXIT
trap 'restore_echo; echo; exit 130' INT TERM HUP
stty -echo < /dev/tty

while IFS= read -r line <&3; do
  line="${line%$'\r'}"
  if [ "$line" = "FINE_CREDENZIALI" ]; then
    FOUND_END=1
    break
  fi
  [ -n "$line" ] || continue
  case "$line" in
    \#*) continue ;;
    Supabase:) SECTION="supabase"; continue ;;
    Cloudflare:) SECTION="cloudflare"; continue ;;
    GitHub:) SECTION="github"; continue ;;
    Vercel:) SECTION="vercel"; continue ;;
    "Dashboard interna:") SECTION="dashboard"; continue ;;
  esac

  # Compatibilità col primo modello tecnico già distribuito.
  case "$line" in
    COPPO_ADMIN_DASHBOARD_PASSWORD=*) ADMIN_DASHBOARD_PASSWORD="${line#*=}"; continue ;;
    COPPO_SUPABASE_DB_PASSWORD=*) SUPABASE_DB_PASSWORD="${line#*=}"; continue ;;
    COPPO_SUPABASE_ACCESS_TOKEN=*) SUPABASE_ACCESS_TOKEN="${line#*=}"; continue ;;
    COPPO_SUPABASE_SECRET_KEY=*) SUPABASE_SECRET_KEY="${line#*=}"; continue ;;
    COPPO_CLOUDFLARE_ACCOUNT_ID=*) CLOUDFLARE_ACCOUNT_ID="${line#*=}"; continue ;;
    COPPO_CLOUDFLARE_API_TOKEN=*) CLOUDFLARE_API_TOKEN="${line#*=}"; continue ;;
    COPPO_VERCEL_USER_ID=*) VERCEL_USER_ID="${line#*=}"; continue ;;
    COPPO_VERCEL_TOKEN=*) VERCEL_TOKEN="${line#*=}"; continue ;;
  esac

  value="${line#*:}"
  value="${value# }"

  case "$SECTION:$line" in
    :Email:*) EMAIL="$value" ;;
    :Pass:*) EMAIL_PASSWORD="$value" ;;
    supabase:"- Database pass:"*) SUPABASE_DB_PASSWORD="$value" ;;
    supabase:"- Project URL:"*) SUPABASE_URL="$value" ;;
    supabase:"- Access Token (scade domani):"*) SUPABASE_ACCESS_TOKEN="$value" ;;
    supabase:"- Access Token:"*) SUPABASE_ACCESS_TOKEN="$value" ;;
    supabase:"- Secret Key:"*) SUPABASE_SECRET_KEY="$value" ;;
    supabase:"- Anon public:"*) SUPABASE_ANON_KEY="$value" ;;
    supabase:"- Service Role:"*) SUPABASE_SERVICE_ROLE_KEY="$value" ;;
    cloudflare:"- Account ID:"*) CLOUDFLARE_ACCOUNT_ID="$value" ;;
    cloudflare:"- Your API Token:"*) CLOUDFLARE_API_TOKEN="$value" ;;
    cloudflare:"- Access Key ID:"*) CLOUDFLARE_ACCESS_KEY_ID="$value" ;;
    cloudflare:"- Secret Access Key:"*) CLOUDFLARE_SECRET_ACCESS_KEY="$value" ;;
    cloudflare:"- S3 API Endpoint:"*) CLOUDFLARE_S3_ENDPOINT="$value" ;;
    github:"- Repository URL:"*) GITHUB_REPO_URL="$value" ;;
    github:"- https://github.com/"*) GITHUB_REPO_URL="${line#- }" ;;
    vercel:"- User ID:"*) VERCEL_USER_ID="$value" ;;
    vercel:"- AI Gateway API:"*) VERCEL_AI_GATEWAY_API="$value" ;;
    vercel:"- API Token:"*) VERCEL_TOKEN="$value" ;;
    dashboard:"- Pass:"*) ADMIN_DASHBOARD_PASSWORD="$value" ;;
    *)
      restore_echo
      echo
      echo "ERRORE: campo non previsto: $line. Niente è stato salvato." >&2
      exit 1
      ;;
  esac
done

restore_echo
trap - EXIT INT TERM HUP
echo

if [ "$FOUND_END" -ne 1 ]; then
  echo "ERRORE: manca FINE_CREDENZIALI. Niente è stato salvato." >&2
  exit 1
fi

if [ -n "$EMAIL_PASSWORD" ]; then
  echo "ERRORE: lascia vuoto 'Pass' sotto Email: la password Gmail non serve all'app." >&2
  exit 1
fi

if [ -n "$CLOUDFLARE_ACCESS_KEY_ID" ] || [ -n "$CLOUDFLARE_SECRET_ACCESS_KEY" ] || [ -n "$CLOUDFLARE_S3_ENDPOINT" ]; then
  echo "ERRORE: lascia vuoti i tre campi Cloudflare S3/R2: non servono all'app." >&2
  exit 1
fi

if [ -n "$VERCEL_AI_GATEWAY_API" ]; then
  echo "ERRORE: lascia vuoto 'AI Gateway API' e compila invece 'API Token'." >&2
  exit 1
fi

if [ -n "$ADMIN_DASHBOARD_PASSWORD" ] && [ "${#ADMIN_DASHBOARD_PASSWORD}" -lt 14 ]; then
  echo "ERRORE: la password della dashboard deve avere almeno 14 caratteri. Niente salvato." >&2
  exit 1
fi

validate_no_whitespace() {
  local key="$1"
  local value="$2"
  [ -n "$value" ] || return 0
  if printf '%s' "$value" | grep -q '[[:space:]]'; then
    echo "ERRORE: $key contiene spazi o a capo. Niente salvato." >&2
    exit 1
  fi
}

validate_no_whitespace COPPO_ADMIN_DASHBOARD_PASSWORD "$ADMIN_DASHBOARD_PASSWORD"
validate_no_whitespace COPPO_EMAIL "$EMAIL"
validate_no_whitespace COPPO_SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"
validate_no_whitespace COPPO_SUPABASE_URL "$SUPABASE_URL"
validate_no_whitespace COPPO_SUPABASE_ACCESS_TOKEN "$SUPABASE_ACCESS_TOKEN"
validate_no_whitespace COPPO_SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
validate_no_whitespace COPPO_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
validate_no_whitespace COPPO_SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
validate_no_whitespace COPPO_CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
validate_no_whitespace COPPO_CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
validate_no_whitespace COPPO_GITHUB_REPO_URL "$GITHUB_REPO_URL"
validate_no_whitespace COPPO_VERCEL_USER_ID "$VERCEL_USER_ID"
validate_no_whitespace COPPO_VERCEL_TOKEN "$VERCEL_TOKEN"

save_value() {
  local key="$1"
  local value="$2"
  [ -n "$value" ] || return 0
  printf '%s' "$value" | "$SET_SECRET" "$key" --stdin
}

# Dati pubblici già confermati: vengono registrati insieme agli accessi per consentire
# agli script successivi di operare senza chiedere nuovamente riferimenti al cliente.
save_value COPPO_EMAIL "${EMAIL:-votacoppodomande@gmail.com}"
save_value COPPO_GITHUB_REPO_URL "${GITHUB_REPO_URL:-https://github.com/votacoppo/domande}"
save_value COPPO_SUPABASE_URL "${SUPABASE_URL:-https://oektjluyukxtqzwhbrbd.supabase.co}"
save_value COPPO_SUPABASE_PROJECT_REF "oektjluyukxtqzwhbrbd"

save_value COPPO_ADMIN_DASHBOARD_PASSWORD "$ADMIN_DASHBOARD_PASSWORD"
save_value COPPO_SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"
save_value COPPO_SUPABASE_ACCESS_TOKEN "$SUPABASE_ACCESS_TOKEN"
save_value COPPO_SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
save_value COPPO_SUPABASE_ANON_KEY "$SUPABASE_ANON_KEY"
save_value COPPO_SUPABASE_SERVICE_ROLE_KEY "$SUPABASE_SERVICE_ROLE_KEY"
save_value COPPO_CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
save_value COPPO_CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
save_value COPPO_VERCEL_USER_ID "$VERCEL_USER_ID"
save_value COPPO_VERCEL_TOKEN "$VERCEL_TOKEN"

echo
echo "Accessi Coppo registrati nella cassaforte. Nessun valore è stato stampato o scritto nel repository."
echo "I campi lasciati vuoti sono stati ignorati e possono essere aggiunti rilanciando lo stesso comando."
