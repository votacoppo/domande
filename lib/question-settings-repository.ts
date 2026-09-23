import "server-only";
import { getAdminClient } from "./supabase-admin";
import {
  DEFAULT_QUESTION_SETTINGS,
  settingsFromRow,
  settingsToRow,
  type QuestionSettings,
} from "./question-settings";

const TABLE = "qea_settings";
const COLUMNS = "name_field, email_field, device_limit_max, device_limit_window_seconds";

export async function getQuestionSettings(): Promise<QuestionSettings> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq("id", 1).single();
  if (error || !data) throw new Error(error?.message ?? "Impostazioni non trovate");
  return settingsFromRow(data as Record<string, unknown>);
}

// Per le pagine pubbliche: se il database non risponde si mostra il modulo anonimo;
// l'invio ricarica le impostazioni e, senza database, si ferma con un 503.
export async function getQuestionSettingsOrDefault(): Promise<QuestionSettings> {
  try {
    return await getQuestionSettings();
  } catch {
    return DEFAULT_QUESTION_SETTINGS;
  }
}

export async function updateQuestionSettings(settings: QuestionSettings): Promise<QuestionSettings> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .update({ ...settingsToRow(settings), updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select(COLUMNS)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Salvataggio non riuscito");
  return settingsFromRow(data as Record<string, unknown>);
}
