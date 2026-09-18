export const SITE_NAME = "Marcello Coppo";
export const SITE_SUBTITLE = "Deputato della Repubblica · Fratelli d’Italia";
export const QEA_PATH = "/QeA";
export const QEA_FORM_PATH = "/QeA/invia";
export const QUESTION_MIN_LENGTH = 3;
export const QUESTION_MAX_LENGTH = 500;
export const TURNSTILE_ACTION = "audience-question";

export function siteUrl(): string {
  const raw = process.env.SITE_URL?.trim();
  if (raw) return raw.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("SITE_URL non configurato");
}

export function questionFormUrl(): string {
  return `${siteUrl()}${QEA_FORM_PATH}`;
}

export function publicSetupComplete(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() && privacyConfig().configured);
}

export function privacyConfig(): {
  configured: boolean;
  controllerName: string;
  controllerContact: string;
  legalBasis: string;
  hostingProvider: string;
  retentionPolicy: string;
} {
  const controllerName = process.env.DATA_CONTROLLER_NAME?.trim() ?? "";
  const controllerContact = process.env.DATA_CONTROLLER_CONTACT?.trim() ?? "";
  const legalBasis = process.env.DATA_PROCESSING_LEGAL_BASIS?.trim() ?? "";
  const hostingProvider = process.env.DATA_HOSTING_PROVIDER?.trim() ?? "";
  const retentionPolicy = process.env.DATA_RETENTION_POLICY?.trim() ?? "";
  return {
    configured: Boolean(
      controllerName && controllerContact && legalBasis && hostingProvider && retentionPolicy,
    ),
    controllerName,
    controllerContact,
    legalBasis,
    hostingProvider,
    retentionPolicy,
  };
}
