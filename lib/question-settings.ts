export type FieldMode = "off" | "optional" | "required";

export type LimitWindowSeconds = 900 | 3600 | 10800 | 86400;

export type QuestionSettings = {
  nameField: FieldMode;
  emailField: FieldMode;
  /** null = nessun limite per persona (resta comunque il tetto per rete). */
  deviceLimitMax: number | null;
  deviceLimitWindowSeconds: LimitWindowSeconds;
};

export const DEFAULT_QUESTION_SETTINGS: QuestionSettings = {
  nameField: "off",
  emailField: "off",
  deviceLimitMax: 3,
  deviceLimitWindowSeconds: 3600,
};

export const FIELD_MODES: Array<{ value: FieldMode; label: string; hint: string }> = [
  { value: "off", label: "Non chiedere", hint: "Il campo non compare nel modulo." },
  { value: "optional", label: "Facoltativo", hint: "Compare, ma si può lasciare vuoto." },
  { value: "required", label: "Obbligatorio", hint: "Senza, la domanda non parte." },
];

export const DEVICE_LIMIT_OPTIONS = [1, 2, 3, 5, 10, 20] as const;

export const LIMIT_WINDOWS: Array<{ value: LimitWindowSeconds; label: string }> = [
  { value: 900, label: "ogni 15 minuti" },
  { value: 3600, label: "ogni ora" },
  { value: 10800, label: "ogni 3 ore" },
  { value: 86400, label: "ogni 24 ore" },
];

const MODES = new Set<FieldMode>(["off", "optional", "required"]);
const WINDOWS = new Set<number>(LIMIT_WINDOWS.map((entry) => entry.value));
const DEVICE_LIMIT_MAX = 50;

function isFieldMode(value: unknown): value is FieldMode {
  return typeof value === "string" && MODES.has(value as FieldMode);
}

function isWindow(value: unknown): value is LimitWindowSeconds {
  return typeof value === "number" && WINDOWS.has(value);
}

function isDeviceLimit(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 1 && Number(value) <= DEVICE_LIMIT_MAX);
}

/** Valida l'input della dashboard: accetta solo i quattro campi previsti. */
export function parseSettingsInput(
  value: unknown,
): { ok: true; value: QuestionSettings } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Impostazioni non valide." };
  }
  const record = value as Record<string, unknown>;
  const allowed = new Set(["nameField", "emailField", "deviceLimitMax", "deviceLimitWindowSeconds"]);
  if (Object.keys(record).some((key) => !allowed.has(key))) {
    return { ok: false, error: "Impostazioni non valide." };
  }
  if (!isFieldMode(record.nameField) || !isFieldMode(record.emailField)) {
    return { ok: false, error: "Scegli come chiedere nome ed email." };
  }
  if (!isDeviceLimit(record.deviceLimitMax) || !isWindow(record.deviceLimitWindowSeconds)) {
    return { ok: false, error: "Limite di domande non valido." };
  }
  return {
    ok: true,
    value: {
      nameField: record.nameField,
      emailField: record.emailField,
      deviceLimitMax: record.deviceLimitMax,
      deviceLimitWindowSeconds: record.deviceLimitWindowSeconds,
    },
  };
}

/** Converte la riga del database; una riga fuori vincolo è un errore, non un default. */
export function settingsFromRow(row: Record<string, unknown>): QuestionSettings {
  const parsed = parseSettingsInput({
    nameField: row.name_field,
    emailField: row.email_field,
    deviceLimitMax: row.device_limit_max ?? null,
    deviceLimitWindowSeconds: Number(row.device_limit_window_seconds),
  });
  if (!parsed.ok) throw new Error("Impostazioni nel database non valide");
  return parsed.value;
}

export function settingsToRow(settings: QuestionSettings) {
  return {
    name_field: settings.nameField,
    email_field: settings.emailField,
    device_limit_max: settings.deviceLimitMax,
    device_limit_window_seconds: settings.deviceLimitWindowSeconds,
  };
}

export function windowLabel(seconds: LimitWindowSeconds): string {
  return LIMIT_WINDOWS.find((entry) => entry.value === seconds)?.label ?? "ogni ora";
}

export function fieldModeLabel(mode: FieldMode): string {
  return FIELD_MODES.find((entry) => entry.value === mode)?.label ?? "Non chiedere";
}

export function describeDeviceLimit(settings: QuestionSettings): string {
  if (settings.deviceLimitMax === null) return "Nessun limite per persona";
  const noun = settings.deviceLimitMax === 1 ? "domanda" : "domande";
  return `${settings.deviceLimitMax} ${noun} ${windowLabel(settings.deviceLimitWindowSeconds)} per telefono`;
}

/** Frase per il pubblico: quali dati chiediamo e cosa ne resta visibile in sala. */
export function identityNotice(settings: QuestionSettings): string {
  if (settings.nameField === "off" && settings.emailField === "off") return "Non chiediamo nome né email.";
  const parts: string[] = [];
  if (settings.nameField === "required") parts.push("Il nome compare insieme alla domanda.");
  if (settings.nameField === "optional") parts.push("Se lasci il nome, compare insieme alla domanda.");
  if (settings.emailField !== "off") parts.push("L’email non compare mai.");
  return parts.join(" ");
}

/** Attesa leggibile per i messaggi di blocco: «12 minuti», «2 ore». */
export function formatWait(seconds: number): string {
  if (seconds < 60) return "meno di un minuto";
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return minutes === 1 ? "1 minuto" : `${minutes} minuti`;
  const hours = Math.ceil(minutes / 60);
  return hours === 1 ? "1 ora" : `${hours} ore`;
}
