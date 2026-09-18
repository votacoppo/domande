import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

const VERCEL_API = "https://api.vercel.com";
const SUPABASE_API = "https://api.supabase.com";
const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const PROJECT_NAME = "votacoppo-domande";
const DESIRED_HOSTNAME = `${PROJECT_NAME}.vercel.app`;
const WIDGET_NAME = "Marcello Coppo Q&A";

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Manca ${name}.`);
  if (/^(?:change[-_ ]?me|replace[-_ ]?me|todo|example|placeholder|xxx+|<.+>)$/i.test(value)) {
    throw new Error(`${name} contiene un valore segnaposto.`);
  }
  return value;
}

async function requestJson(label, url, options = {}, allowedStatuses = []) {
  const response = await fetch(url, options);
  if (!response.ok && !allowedStatuses.includes(response.status)) throw new Error(`${label}: HTTP ${response.status}.`);
  if (response.status === 204) return { response, data: null };
  let data = null;
  try {
    data = await response.json();
  } catch {
    if (response.ok) throw new Error(`${label}: risposta non JSON.`);
  }
  return { response, data };
}

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token) {
  return { ...bearer(token), "Content-Type": "application/json" };
}

function normalizeRepoUrl(value) {
  return value.trim().replace(/\.git$/i, "").replace(/\/$/, "").toLowerCase();
}

function repositorySlug(repoUrl) {
  const match = repoUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?\/?$/i);
  if (!match) throw new Error("COPPO_GITHUB_REPO_URL non è un repository GitHub valido.");
  return match[1];
}

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function loadConfiguration() {
  const configuration = {
    supabaseToken: required("COPPO_SUPABASE_ACCESS_TOKEN"),
    projectRef: required("COPPO_SUPABASE_PROJECT_REF"),
    cloudflareToken: required("COPPO_CLOUDFLARE_API_TOKEN"),
    cloudflareAccount: required("COPPO_CLOUDFLARE_ACCOUNT_ID"),
    vercelToken: required("COPPO_VERCEL_TOKEN"),
    expectedVercelUser: required("COPPO_VERCEL_USER_ID"),
    repoUrl: required("COPPO_GITHUB_REPO_URL"),
    supabaseUrl: required("COPPO_SUPABASE_URL"),
    supabaseServiceRoleKey: required("COPPO_SUPABASE_SERVICE_ROLE_KEY"),
    email: required("COPPO_EMAIL"),
    adminPasswordHash: required("COPPO_ADMIN_PASSWORD_HASH"),
    adminSessionSecret: required("COPPO_ADMIN_SESSION_SECRET"),
    adminSessionEpoch: required("COPPO_ADMIN_SESSION_EPOCH"),
    ipHashSecret: required("COPPO_IP_HASH_SECRET"),
  };
  repositorySlug(configuration.repoUrl);
  return configuration;
}

async function vercelUser(token) {
  const { data } = await requestJson("Vercel utente", `${VERCEL_API}/v2/user`, { headers: bearer(token) });
  return data?.user ?? data;
}

async function vercelTeams(token) {
  const { data } = await requestJson("Vercel team", `${VERCEL_API}/v2/teams?limit=100`, {
    headers: bearer(token),
  });
  if (!Array.isArray(data?.teams)) throw new Error("Vercel non ha restituito l'elenco dei profili.");
  return data.teams;
}

async function getVercelProject(token, name = PROJECT_NAME) {
  const { response, data } = await requestJson(
    "Vercel progetto",
    `${VERCEL_API}/v9/projects/${encodeURIComponent(name)}`,
    { headers: bearer(token) },
    [404],
  );
  return response.status === 404 ? null : data;
}

function assertVercelUser(user, expectedUserId) {
  if (!user?.id) throw new Error("Vercel non ha restituito l'utente autenticato.");
  if (user.id !== expectedUserId) throw new Error("Il token Vercel appartiene a un utente diverso da quello indicato.");
  const plan = user.billing?.plan ?? user.plan;
  if (plan && plan !== "hobby") throw new Error("L'account Vercel non risulta Hobby.");
}

function assertOwnedProject(project, configuration, teams) {
  if (!project?.id || project.name !== PROJECT_NAME) throw new Error("Il progetto Vercel trovato non è quello atteso.");
  if (project.accountId && project.accountId !== configuration.expectedVercelUser) {
    const ownerTeam = teams.find((team) => team.id === project.accountId);
    const teamPlan = ownerTeam?.billing?.plan ?? ownerTeam?.plan;
    if (!ownerTeam || ownerTeam.creatorId !== configuration.expectedVercelUser || teamPlan !== "hobby") {
      throw new Error("Il progetto Vercel appartiene a un profilo diverso da quello Hobby del cliente.");
    }
  }
  if (project.link) {
    const linkedRepo = `${project.link.org}/${project.link.repo}`;
    if (project.link.type !== "github" || linkedRepo.toLowerCase() !== repositorySlug(configuration.repoUrl).toLowerCase()) {
      throw new Error("Il progetto Vercel esistente è collegato a un repository diverso.");
    }
  }
}

async function inspectServices(configuration) {
  const { data: supabaseProject } = await requestJson(
    "Supabase progetto",
    `${SUPABASE_API}/v1/projects/${encodeURIComponent(configuration.projectRef)}`,
    { headers: bearer(configuration.supabaseToken) },
  );
  if (supabaseProject?.id !== configuration.projectRef) throw new Error("Il token Supabase non punta al progetto atteso.");

  const { data: cloudflareWidgets } = await requestJson(
    "Cloudflare Turnstile",
    `${CLOUDFLARE_API}/accounts/${encodeURIComponent(configuration.cloudflareAccount)}/challenges/widgets?per_page=5`,
    { headers: bearer(configuration.cloudflareToken) },
  );
  if (!cloudflareWidgets?.success) throw new Error("Cloudflare non ha confermato l'accesso Turnstile.");

  const user = await vercelUser(configuration.vercelToken);
  assertVercelUser(user, configuration.expectedVercelUser);
  const teams = await vercelTeams(configuration.vercelToken);
  const project = await getVercelProject(configuration.vercelToken);
  if (project) assertOwnedProject(project, configuration, teams);

  const localRemote = normalizeRepoUrl(git("remote", "get-url", "origin"));
  if (localRemote !== normalizeRepoUrl(configuration.repoUrl)) throw new Error("Il remote Git locale non corrisponde a COPPO_GITHUB_REPO_URL.");
  // Un repository appena creato non ha ancora ref: ls-remote senza --exit-code
  // verifica comunque raggiungibilità e autorizzazione senza rifiutare il caso vuoto.
  git("ls-remote", "origin");

  return { cloudflareWidgets, project, supabaseProject, teams };
}

async function preflight() {
  const configuration = loadConfiguration();
  const inspected = await inspectServices(configuration);
  process.stdout.write(`OK Supabase: progetto ${configuration.projectRef}, stato ${inspected.supabaseProject.status ?? "riconosciuto"}\n`);
  process.stdout.write(`OK Cloudflare: accesso Turnstile, widget visibili ${inspected.cloudflareWidgets.result_info?.total_count ?? inspected.cloudflareWidgets.result?.length ?? 0}\n`);
  process.stdout.write(`OK Vercel: identità verificata, piano Hobby, progetto ${inspected.project ? "già presente e coerente" : "da creare"}\n`);
  process.stdout.write("OK GitHub: remote raggiungibile e coerente\n");
}

async function ensureVercelProject(configuration, teams) {
  const existing = await getVercelProject(configuration.vercelToken);
  if (existing) {
    assertOwnedProject(existing, configuration, teams);
    return existing;
  }
  const { data } = await requestJson("Creazione progetto Vercel", `${VERCEL_API}/v11/projects`, {
    method: "POST",
    headers: jsonHeaders(configuration.vercelToken),
    body: JSON.stringify({ name: PROJECT_NAME, framework: "nextjs" }),
  });
  assertOwnedProject(data, configuration, teams);
  return data;
}

async function projectDomains(token, projectId) {
  const { data } = await requestJson(
    "Domini Vercel",
    `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains`,
    { headers: bearer(token) },
  );
  return Array.isArray(data?.domains) ? data.domains : [];
}

async function ensureProductionHostname(token, projectId) {
  let domains = await projectDomains(token, projectId);
  let domain = domains.find((candidate) => candidate.name === DESIRED_HOSTNAME);
  if (!domain) {
    const { data } = await requestJson(
      "Associazione dominio Vercel",
      `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/domains`,
      { method: "POST", headers: jsonHeaders(token), body: JSON.stringify({ name: DESIRED_HOSTNAME }) },
    );
    domain = data;
  }
  if (!domain?.verified) {
    await requestJson(
      "Verifica dominio Vercel",
      `${VERCEL_API}/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(DESIRED_HOSTNAME)}/verify`,
      { method: "POST", headers: jsonHeaders(token) },
    );
  }
  domains = await projectDomains(token, projectId);
  domain = domains.find((candidate) => candidate.name === DESIRED_HOSTNAME);
  if (!domain?.verified) throw new Error("Il dominio Vercel gratuito non risulta associato e verificato.");
  return domain.name;
}

async function ensureTurnstileWidget(token, accountId, hostname) {
  const endpoint = `${CLOUDFLARE_API}/accounts/${encodeURIComponent(accountId)}/challenges/widgets`;
  const { data: listed } = await requestJson("Elenco widget Turnstile", `${endpoint}?per_page=1000`, { headers: bearer(token) });
  if (!listed?.success || !Array.isArray(listed.result)) throw new Error("Elenco Turnstile non valido.");
  const exactDomains = (candidate) => Array.isArray(candidate.domains) && candidate.domains.length === 1 && candidate.domains[0] === hostname;
  let widget = listed.result.find((candidate) => candidate.name === WIDGET_NAME);
  if (widget && (widget.mode !== "managed" || !exactDomains(widget))) {
    throw new Error("Esiste già un widget Turnstile con questo nome ma configurazione diversa.");
  }
  if (!widget) widget = listed.result.find((candidate) => candidate.mode === "managed" && exactDomains(candidate));
  if (widget && !widget.secret) {
    const { data: detailed } = await requestJson(
      "Dettaglio widget Turnstile",
      `${endpoint}/${encodeURIComponent(widget.sitekey)}`,
      { headers: bearer(token) },
    );
    widget = detailed?.result;
  }
  if (!widget) {
    const { data: created } = await requestJson("Creazione widget Turnstile", endpoint, {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify({ domains: [hostname], mode: "managed", name: WIDGET_NAME }),
    });
    if (!created?.success) throw new Error("Cloudflare non ha confermato la creazione del widget.");
    widget = created.result;
  }
  if (!widget?.sitekey || !widget?.secret || widget.mode !== "managed" || !exactDomains(widget)) {
    throw new Error("Il widget Turnstile non contiene la configurazione strettamente attesa.");
  }
  return widget;
}

function envEntry(key, value, secret = false) {
  return { key, value, type: secret ? "sensitive" : "encrypted", target: ["production"] };
}

function targetEqualsProduction(target) {
  return Array.isArray(target) && target.length === 1 && target[0] === "production";
}

async function setAndVerifyEnvironment(token, projectId, environmentVariables) {
  const { data } = await requestJson(
    "Configurazione variabili Vercel",
    `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env?upsert=true`,
    { method: "POST", headers: jsonHeaders(token), body: JSON.stringify(environmentVariables) },
  );
  if (Array.isArray(data?.failed) && data.failed.length) throw new Error(`Vercel non ha configurato ${data.failed.length} variabili.`);
  const { data: envData } = await requestJson(
    "Rilettura variabili Vercel",
    `${VERCEL_API}/v10/projects/${encodeURIComponent(projectId)}/env`,
    { headers: bearer(token) },
  );
  const remote = Array.isArray(envData?.envs) ? envData.envs : [];
  for (const expected of environmentVariables) {
    const actual = remote.find((entry) => entry.key === expected.key);
    if (!actual || actual.type !== expected.type || !targetEqualsProduction(actual.target)) {
      throw new Error(`La variabile Vercel ${expected.key} non è stata riletta con tipo e target attesi.`);
    }
  }
}

async function configure() {
  const configuration = loadConfiguration();
  const inspected = await inspectServices(configuration);
  const project = await ensureVercelProject(configuration, inspected.teams);
  const hostname = await ensureProductionHostname(configuration.vercelToken, project.id);
  const siteUrl = `https://${hostname}`;
  const widget = await ensureTurnstileWidget(configuration.cloudflareToken, configuration.cloudflareAccount, hostname);
  const environmentVariables = [
    envEntry("SITE_URL", siteUrl),
    envEntry("DEPLOY_PLATFORM", "vercel"),
    envEntry("SUPABASE_URL", configuration.supabaseUrl),
    envEntry("SUPABASE_SERVICE_ROLE_KEY", configuration.supabaseServiceRoleKey, true),
    envEntry("NEXT_PUBLIC_TURNSTILE_SITE_KEY", widget.sitekey),
    envEntry("TURNSTILE_SECRET_KEY", widget.secret, true),
    envEntry("TURNSTILE_EXPECTED_HOSTNAMES", hostname),
    envEntry("ADMIN_EMAIL", configuration.email),
    envEntry("ADMIN_PASSWORD_HASH", configuration.adminPasswordHash, true),
    envEntry("ADMIN_SESSION_SECRET", configuration.adminSessionSecret, true),
    envEntry("ADMIN_SESSION_EPOCH", configuration.adminSessionEpoch),
    envEntry("IP_HASH_SECRET", configuration.ipHashSecret, true),
    envEntry("DATA_CONTROLLER_NAME", "Marcello Coppo"),
    envEntry("DATA_CONTROLLER_CONTACT", "votacoppo@gmail.com"),
    envEntry("DATA_PROCESSING_LEGAL_BASIS", "Consenso dell'interessato ai sensi dell'art. 6, par. 1, lett. a) GDPR"),
    envEntry("DATA_HOSTING_PROVIDER", "Vercel per l'hosting, Supabase per il database e Cloudflare Turnstile per l'anti-spam"),
    envEntry("DATA_RETENTION_POLICY", "Domande e archivi vengono eliminati automaticamente da Supabase entro 30 giorni; gli identificatori tecnici usati per il rate limit entro 2 giorni. Il titolare può cancellare prima i dati dalla dashboard."),
  ];
  await setAndVerifyEnvironment(configuration.vercelToken, project.id, environmentVariables);
  process.stdout.write(`OK Vercel project: ${project.name}\n`);
  process.stdout.write(`OK produzione configurata: ${siteUrl}\n`);
  process.stdout.write(`OK Turnstile Managed: dominio esclusivo ${hostname}\n`);
  process.stdout.write(`OK variabili Vercel: ${environmentVariables.length} nomi riletti\n`);
}

function assertDeployableGitState(expectedRepoUrl) {
  if (git("status", "--porcelain")) throw new Error("Il repository contiene modifiche non committate.");
  if (git("branch", "--show-current") !== "main") throw new Error("Il deploy di produzione richiede il branch main.");
  if (normalizeRepoUrl(git("remote", "get-url", "origin")) !== normalizeRepoUrl(expectedRepoUrl)) throw new Error("Il remote origin non è quello atteso.");
  const head = git("rev-parse", "HEAD");
  const remoteHead = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
  if (!remoteHead || remoteHead !== head) throw new Error("HEAD non coincide con origin/main: prima occorre pubblicare il commit esatto.");
  return head;
}

function committedFiles() {
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", "HEAD"], {
    encoding: "buffer",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return output.toString("utf8").split("\0").filter(Boolean).map((file) => ({
    file,
    content: execFileSync("git", ["show", `HEAD:${file}`], { encoding: "buffer" }),
  }));
}

async function uploadFile(token, file) {
  const sha = createHash("sha1").update(file.content).digest("hex");
  const response = await fetch(`${VERCEL_API}/v2/files`, {
    method: "POST",
    headers: { ...bearer(token), "Content-Type": "application/octet-stream", "x-vercel-digest": sha },
    body: file.content,
  });
  if (!response.ok) throw new Error(`Upload Vercel ${file.file}: HTTP ${response.status}.`);
  return { file: file.file, sha, size: file.content.length };
}

async function uploadCommittedFiles(token) {
  const sourceFiles = committedFiles();
  const uploaded = [];
  for (let index = 0; index < sourceFiles.length; index += 8) {
    uploaded.push(...(await Promise.all(sourceFiles.slice(index, index + 8).map((file) => uploadFile(token, file)))));
  }
  return uploaded;
}

async function waitForDeployment(token, deploymentId, hostname, commitSha) {
  const deadline = Date.now() + 10 * 60_000;
  while (Date.now() < deadline) {
    const { data } = await requestJson(
      "Stato deployment Vercel",
      `${VERCEL_API}/v13/deployments/${encodeURIComponent(deploymentId)}`,
      { headers: bearer(token) },
    );
    if (["ERROR", "CANCELED"].includes(data?.readyState)) throw new Error(`Deployment Vercel terminato in stato ${data.readyState}.`);
    if (data?.readyState === "READY") {
      const aliases = Array.isArray(data.alias) ? data.alias : [];
      if (data.target !== "production") throw new Error("Il deployment pronto non ha target production.");
      if (data.meta?.sourceCommitSha !== commitSha) throw new Error("Il deployment pronto non dichiara il commit atteso.");
      if (data.aliasError) throw new Error("Vercel ha segnalato un errore nell'assegnazione dell'alias di produzione.");
      if (aliases.includes(hostname) && data.aliasAssigned !== false) return data;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000));
  }
  throw new Error("Il deployment Vercel non si è concluso entro 10 minuti.");
}

async function deploy() {
  const configuration = loadConfiguration();
  const inspected = await inspectServices(configuration);
  if (!inspected.project) throw new Error("Il progetto Vercel deve essere configurato prima del deploy.");
  const hostname = await ensureProductionHostname(configuration.vercelToken, inspected.project.id);
  const commitSha = assertDeployableGitState(configuration.repoUrl);
  const files = await uploadCommittedFiles(configuration.vercelToken);
  const { data: created } = await requestJson("Creazione deployment Vercel", `${VERCEL_API}/v13/deployments`, {
    method: "POST",
    headers: jsonHeaders(configuration.vercelToken),
    body: JSON.stringify({
      name: PROJECT_NAME,
      project: inspected.project.id,
      files,
      target: "production",
      projectSettings: { framework: "nextjs" },
      gitMetadata: { remoteUrl: configuration.repoUrl, commitRef: "main", commitSha, dirty: false },
      meta: { sourceCommitSha: commitSha },
    }),
  });
  if (!created?.id) throw new Error("Vercel non ha restituito l'identificativo del deployment.");
  const ready = await waitForDeployment(configuration.vercelToken, created.id, hostname, commitSha);
  process.stdout.write(`OK DEPLOYMENT: ${ready.id}\n`);
  process.stdout.write(`OK COMMIT: ${commitSha}\n`);
  process.stdout.write(`PRODUCTION_URL=https://${hostname}\n`);
}

async function status() {
  const configuration = loadConfiguration();
  const project = await getVercelProject(configuration.vercelToken);
  if (!project) throw new Error("Progetto Vercel non ancora creato.");
  const teams = await vercelTeams(configuration.vercelToken);
  assertOwnedProject(project, configuration, teams);
  const domains = await projectDomains(configuration.vercelToken, project.id);
  const productionDomain = domains.find((domain) => domain.name === DESIRED_HOSTNAME && domain.verified);
  const { data: envData } = await requestJson(
    "Variabili Vercel",
    `${VERCEL_API}/v10/projects/${encodeURIComponent(project.id)}/env`,
    { headers: bearer(configuration.vercelToken) },
  );
  const envs = envData?.envs ?? [];
  const { data: deployments } = await requestJson(
    "Deployment Vercel",
    `${VERCEL_API}/v6/deployments?projectId=${encodeURIComponent(project.id)}&target=production&limit=1`,
    { headers: bearer(configuration.vercelToken) },
  );
  const latest = deployments?.deployments?.[0];
  let deployment = latest;
  const deploymentId = latest?.uid ?? latest?.id;
  if (deploymentId) {
    const detail = await requestJson(
      "Dettaglio deployment Vercel",
      `${VERCEL_API}/v13/deployments/${encodeURIComponent(deploymentId)}`,
      { headers: bearer(configuration.vercelToken) },
    );
    deployment = detail.data;
  }
  const aliases = Array.isArray(deployment?.alias) ? deployment.alias : [];
  const liveUrl = productionDomain && aliases.includes(productionDomain.name) ? `https://${productionDomain.name}` : "assente";
  process.stdout.write(`VERCEL_PROJECT=${project.name}\n`);
  process.stdout.write(`PRODUCTION_URL=${liveUrl}\n`);
  process.stdout.write(`ENV_NAMES=${Array.isArray(envs) ? envs.map((entry) => entry.key).sort().join(",") : "non-disponibili"}\n`);
  process.stdout.write(`DEPLOYMENT_STATE=${deployment?.readyState ?? "assente"}\n`);
  process.stdout.write(`DEPLOYMENT_SHA=${deployment?.meta?.sourceCommitSha ?? "assente"}\n`);
}

const mode = process.argv[2];
try {
  if (mode === "preflight") await preflight();
  else if (mode === "configure") await configure();
  else if (mode === "deploy") await deploy();
  else if (mode === "status") await status();
  else throw new Error("Uso: node scripts/deploy-coppo.mjs <preflight|configure|deploy|status>");
} catch (error) {
  process.stderr.write(`ERRORE: ${error instanceof Error ? error.message : "operazione fallita"}\n`);
  process.exitCode = 1;
}
