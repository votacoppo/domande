"use client";

import { useEffect, useState } from "react";
import {
  DEVICE_LIMIT_OPTIONS,
  FIELD_MODES,
  LIMIT_WINDOWS,
  describeDeviceLimit,
  fieldModeLabel,
  type FieldMode,
  type LimitWindowSeconds,
  type QuestionSettings,
} from "@/lib/question-settings";

function sameSettings(a: QuestionSettings, b: QuestionSettings): boolean {
  return a.nameField === b.nameField
    && a.emailField === b.emailField
    && a.deviceLimitMax === b.deviceLimitMax
    && a.deviceLimitWindowSeconds === b.deviceLimitWindowSeconds;
}

function ModeSelector({ name, legend, hint, value, disabled, onChange }: {
  name: string;
  legend: string;
  hint: string;
  value: FieldMode;
  disabled: boolean;
  onChange: (value: FieldMode) => void;
}) {
  return (
    <fieldset className="setting-group">
      <legend className="label">{legend}</legend>
      <p className="field-hint">{hint}</p>
      <div className="segmented" role="radiogroup" aria-label={legend}>
        {FIELD_MODES.map((mode) => (
          <label key={mode.value} className={`segment${value === mode.value ? " segment-active" : ""}`}>
            <input
              type="radio"
              name={name}
              value={mode.value}
              checked={value === mode.value}
              disabled={disabled}
              onChange={() => onChange(mode.value)}
            />
            <span className="segment-title">{mode.label}</span>
            <span className="segment-hint">{mode.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Le impostazioni si caricano una volta sola, fuori dal polling delle domande:
// un aggiornamento automatico cancellerebbe le scelte non ancora salvate.
export function QuestionSettingsPanel({ reviewSettings }: { reviewSettings?: QuestionSettings }) {
  const review = Boolean(reviewSettings);
  const [saved, setSaved] = useState<QuestionSettings | null>(reviewSettings ?? null);
  const [draft, setDraft] = useState<QuestionSettings | null>(reviewSettings ?? null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (review) return;
    let active = true;
    void (async () => {
      try {
        const response = await fetch("/api/interno/impostazioni", { cache: "no-store" });
        const data = (await response.json()) as { settings?: QuestionSettings; error?: string };
        if (!active) return;
        if (!response.ok || !data.settings) {
          setError(data.error ?? "Impostazioni non disponibili.");
          return;
        }
        setSaved(data.settings);
        setDraft(data.settings);
      } catch {
        if (active) setError("Errore di rete: impostazioni non caricate.");
      }
    })();
    return () => {
      active = false;
    };
  }, [review]);

  const dirty = Boolean(saved && draft && !sameSettings(saved, draft));

  function update(patch: Partial<QuestionSettings>) {
    setNotice("");
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  async function save() {
    if (review || !draft) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/interno/impostazioni", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await response.json()) as { settings?: QuestionSettings; error?: string };
      if (!response.ok || !data.settings) {
        setError(data.error ?? "Salvataggio non riuscito.");
        return;
      }
      setSaved(data.settings);
      setDraft(data.settings);
      setNotice("Salvato: il modulo pubblico usa già queste impostazioni.");
    } catch {
      setError("Errore di rete: impostazioni non salvate.");
    } finally {
      setSaving(false);
    }
  }

  const summary = saved
    ? `Nome: ${fieldModeLabel(saved.nameField)} · Email: ${fieldModeLabel(saved.emailField)} · ${describeDeviceLimit(saved)}`
    : error || "Caricamento impostazioni…";

  return (
    <section className="panel settings-panel">
      <button
        type="button"
        className="settings-toggle"
        aria-expanded={open}
        aria-controls="impostazioni-modulo"
        onClick={() => setOpen((value) => !value)}
      >
        <span>
          <span className="settings-title">Impostazioni del modulo</span>
          <span className="settings-summary">{summary}</span>
        </span>
        <span className="settings-chevron" aria-hidden="true">{open ? "▲" : "▼"}</span>
      </button>

      {open && draft ? (
        <div id="impostazioni-modulo" className="settings-body">
          <ModeSelector
            name="nameField"
            legend="Nome e cognome"
            hint="Se la persona lo scrive, compare in sala sotto la sua domanda."
            value={draft.nameField}
            disabled={saving}
            onChange={(value) => update({ nameField: value })}
          />
          <ModeSelector
            name="emailField"
            legend="Email"
            hint="La vedi solo tu qui in dashboard: non compare mai in sala."
            value={draft.emailField}
            disabled={saving}
            onChange={(value) => update({ emailField: value })}
          />

          <fieldset className="setting-group">
            <legend className="label">Limite di domande per persona</legend>
            <p className="field-hint">
              Conta le domande inviate dallo stesso telefono, anche se tutta la sala usa la stessa
              Wi‑Fi. Chi apre una finestra in incognito riparte da zero; resta comunque un tetto di
              sicurezza di 60 domande all’ora per rete.
            </p>
            <div className="limit-row">
              <label className="field" style={{ margin: 0 }}>
                <span className="field-hint">Quante domande</span>
                <select
                  className="input"
                  value={draft.deviceLimitMax === null ? "none" : String(draft.deviceLimitMax)}
                  disabled={saving}
                  onChange={(event) => update({
                    deviceLimitMax: event.target.value === "none" ? null : Number(event.target.value),
                  })}
                >
                  {DEVICE_LIMIT_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option === 1 ? "1 domanda" : `${option} domande`}</option>
                  ))}
                  <option value="none">Nessun limite per persona</option>
                </select>
              </label>
              <label className="field" style={{ margin: 0 }}>
                <span className="field-hint">Ogni quanto</span>
                <select
                  className="input"
                  value={draft.deviceLimitWindowSeconds}
                  disabled={saving || draft.deviceLimitMax === null}
                  onChange={(event) => update({
                    deviceLimitWindowSeconds: Number(event.target.value) as LimitWindowSeconds,
                  })}
                >
                  {LIMIT_WINDOWS.map((entry) => (
                    <option key={entry.value} value={entry.value}>{entry.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="limit-preview">Ora: <strong>{describeDeviceLimit(draft)}</strong></p>
          </fieldset>

          <div className="settings-actions">
            <button className="button" type="button" disabled={review || saving || !dirty} onClick={() => void save()}>
              {saving ? "Salvataggio…" : "Salva impostazioni"}
            </button>
            {dirty ? <span className="settings-state settings-state-dirty">Modifiche non salvate</span> : null}
            {!dirty && notice ? <span className="settings-state settings-state-ok" role="status">{notice}</span> : null}
            {review ? <span className="settings-state">Anteprima: il salvataggio è disattivato.</span> : null}
          </div>
        </div>
      ) : null}
      {open && error ? <p className="notice notice-error" role="alert">{error}</p> : null}
    </section>
  );
}
