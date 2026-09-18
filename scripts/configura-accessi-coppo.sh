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
COPPO_ADMIN_DASHBOARD_PASSWORD=
COPPO_SUPABASE_DB_PASSWORD=
COPPO_SUPABASE_ACCESS_TOKEN=
COPPO_SUPABASE_SECRET_KEY=
COPPO_CLOUDFLARE_ACCOUNT_ID=
COPPO_CLOUDFLARE_API_TOKEN=
COPPO_VERCEL_USER_ID=
COPPO_VERCEL_TOKEN=
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
SUPABASE_DB_PASSWORD=""
SUPABASE_ACCESS_TOKEN=""
SUPABASE_SECRET_KEY=""
CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_API_TOKEN=""
VERCEL_USER_ID=""
VERCEL_TOKEN=""
FOUND_END=0

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

  key="${line%%=*}"
  value="${line#*=}"
  if [ "$key" = "$line" ]; then
    restore_echo
    echo
    echo "ERRORE: riga senza '='. Niente è stato salvato." >&2
    exit 1
  fi

  case "$key" in
    COPPO_ADMIN_DASHBOARD_PASSWORD) ADMIN_DASHBOARD_PASSWORD="$value" ;;
    COPPO_SUPABASE_DB_PASSWORD) SUPABASE_DB_PASSWORD="$value" ;;
    COPPO_SUPABASE_ACCESS_TOKEN) SUPABASE_ACCESS_TOKEN="$value" ;;
    COPPO_SUPABASE_SECRET_KEY) SUPABASE_SECRET_KEY="$value" ;;
    COPPO_CLOUDFLARE_ACCOUNT_ID) CLOUDFLARE_ACCOUNT_ID="$value" ;;
    COPPO_CLOUDFLARE_API_TOKEN) CLOUDFLARE_API_TOKEN="$value" ;;
    COPPO_VERCEL_USER_ID) VERCEL_USER_ID="$value" ;;
    COPPO_VERCEL_TOKEN) VERCEL_TOKEN="$value" ;;
    *)
      restore_echo
      echo
      echo "ERRORE: campo non previsto: $key. Niente è stato salvato." >&2
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
validate_no_whitespace COPPO_SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"
validate_no_whitespace COPPO_SUPABASE_ACCESS_TOKEN "$SUPABASE_ACCESS_TOKEN"
validate_no_whitespace COPPO_SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
validate_no_whitespace COPPO_CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
validate_no_whitespace COPPO_CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
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
save_value COPPO_EMAIL "votacoppodomande@gmail.com"
save_value COPPO_GITHUB_REPO_URL "https://github.com/votacoppo/domande"
save_value COPPO_SUPABASE_URL "https://oektjluyukxtqzwhbrbd.supabase.co"
save_value COPPO_SUPABASE_PROJECT_REF "oektjluyukxtqzwhbrbd"

save_value COPPO_ADMIN_DASHBOARD_PASSWORD "$ADMIN_DASHBOARD_PASSWORD"
save_value COPPO_SUPABASE_DB_PASSWORD "$SUPABASE_DB_PASSWORD"
save_value COPPO_SUPABASE_ACCESS_TOKEN "$SUPABASE_ACCESS_TOKEN"
save_value COPPO_SUPABASE_SECRET_KEY "$SUPABASE_SECRET_KEY"
save_value COPPO_CLOUDFLARE_ACCOUNT_ID "$CLOUDFLARE_ACCOUNT_ID"
save_value COPPO_CLOUDFLARE_API_TOKEN "$CLOUDFLARE_API_TOKEN"
save_value COPPO_VERCEL_USER_ID "$VERCEL_USER_ID"
save_value COPPO_VERCEL_TOKEN "$VERCEL_TOKEN"

echo
echo "Accessi Coppo registrati nella cassaforte. Nessun valore è stato stampato o scritto nel repository."
echo "I campi lasciati vuoti sono stati ignorati e possono essere aggiunti rilanciando lo stesso comando."
