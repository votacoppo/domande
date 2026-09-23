"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH, TURNSTILE_ACTION } from "@/lib/config";
import { CONTACT_EMAIL_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH } from "@/lib/question-input";
import type { FieldMode, QuestionSettings } from "@/lib/question-settings";

function fieldSuffix(mode: FieldMode, feminine = false): string {
  if (mode === "required") return "";
  return feminine ? " (facoltativa)" : " (facoltativo)";
}

export function QuestionForm({ enabled, siteKey, settings, preview = false }: {
  enabled: boolean;
  siteKey: string;
  settings: QuestionSettings;
  /** Anteprima di sviluppo: mostra i campi senza Turnstile e senza invio. */
  preview?: boolean;
}) {
  const [questionText, setQuestionText] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [gotcha, setGotcha] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loadedAt, setLoadedAt] = useState(() => Date.now());
  const widget = useRef<TurnstileInstance | null>(null);
  function resetCaptcha() {
    setToken("");
    widget.current?.reset();
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = questionText.trim();
    const questionLength = Array.from(trimmed).length;
    if (!enabled || !siteKey) {
      setStatus("error");
      setMessage("Il modulo non è ancora disponibile.");
      return;
    }
    if (questionLength < QUESTION_MIN_LENGTH || questionLength > QUESTION_MAX_LENGTH) {
      setStatus("error");
      setMessage(`Scrivi una domanda tra ${QUESTION_MIN_LENGTH} e ${QUESTION_MAX_LENGTH} caratteri.`);
      return;
    }
    if (settings.nameField === "required" && !displayName.trim()) {
      setStatus("error");
      setMessage("Inserisci nome e cognome.");
      return;
    }
    if (settings.emailField === "required" && !contactEmail.trim()) {
      setStatus("error");
      setMessage("Inserisci la tua email.");
      return;
    }
    if (!privacyAccepted) {
      setStatus("error");
      setMessage("Devi accettare l’informativa privacy.");
      return;
    }
    if (!token) {
      setStatus("error");
      setMessage("Completa la verifica anti-spam.");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const response = await fetch("/api/domande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionText: trimmed,
          ...(settings.nameField !== "off" ? { displayName: displayName.trim() } : {}),
          ...(settings.emailField !== "off" ? { contactEmail: contactEmail.trim() } : {}),
          privacyAccepted: true,
          _gotcha: gotcha,
          formLoadedAt: loadedAt,
          turnstileToken: token,
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "Invio non riuscito. Riprova.");
        resetCaptcha();
        return;
      }
      setStatus("success");
      setQuestionText("");
      setPrivacyAccepted(false);
      resetCaptcha();
    } catch {
      setStatus("error");
      setMessage("Errore di rete. Controlla la connessione e riprova.");
      resetCaptcha();
    }
  }

  if (status === "success") {
    return (
      <div className="panel form-panel" role="status">
        <h2>Domanda inviata</h2>
        <p className="lede">Grazie. Se verrà selezionata, apparirà sullo schermo in sala.</p>
        <button
          type="button"
          className="button button-secondary"
          onClick={() => {
            setLoadedAt(Date.now());
            setStatus("idle");
          }}
        >
          Invia un’altra domanda
        </button>
      </div>
    );
  }

  return (
    <form className="panel form-panel" onSubmit={submit}>
      {!enabled ? (
        <p className="notice notice-error" role="alert">
          Il modulo è chiuso finché non vengono inseriti i dati del titolare privacy e la
          configurazione anti-spam.
        </p>
      ) : null}
      <div className="field">
        <label className="label" htmlFor="questionText">La tua domanda</label>
        <p className="field-hint">
          Nella domanda non inserire dati di terzi o informazioni delicate.
        </p>
        <textarea
          className="textarea"
          id="questionText"
          name="questionText"
          value={questionText}
          required
          disabled={!enabled || status === "loading"}
          placeholder="Scrivi qui la domanda che vorresti fare…"
          onChange={(event) => {
            setQuestionText(Array.from(event.target.value).slice(0, QUESTION_MAX_LENGTH).join(""));
          }}
        />
        <span className="counter">{Array.from(questionText).length}/{QUESTION_MAX_LENGTH}</span>
      </div>

      {settings.nameField !== "off" ? (
        <div className="field">
          <label className="label" htmlFor="displayName">
            Nome e cognome{fieldSuffix(settings.nameField)}
          </label>
          <p className="field-hint">Se la domanda viene scelta, il nome compare sullo schermo in sala.</p>
          <input
            className="input"
            id="displayName"
            name="displayName"
            autoComplete="name"
            value={displayName}
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            required={settings.nameField === "required"}
            disabled={!enabled || status === "loading"}
            onChange={(event) => setDisplayName(event.target.value)}
          />
        </div>
      ) : null}

      {settings.emailField !== "off" ? (
        <div className="field">
          <label className="label" htmlFor="contactEmail">
            Email{fieldSuffix(settings.emailField, true)}
          </label>
          <p className="field-hint">Non verrà mai mostrata: serve solo per ricontattarti su questa domanda.</p>
          <input
            className="input"
            id="contactEmail"
            name="contactEmail"
            type="email"
            inputMode="email"
            autoComplete="email"
            value={contactEmail}
            maxLength={CONTACT_EMAIL_MAX_LENGTH}
            required={settings.emailField === "required"}
            disabled={!enabled || status === "loading"}
            onChange={(event) => setContactEmail(event.target.value)}
          />
        </div>
      ) : null}

      <div className="hidden-honeypot" aria-hidden="true">
        <label htmlFor="_gotcha">Lascia vuoto</label>
        <input
          id="_gotcha"
          name="_gotcha"
          tabIndex={-1}
          autoComplete="off"
          value={gotcha}
          onChange={(event) => setGotcha(event.target.value)}
        />
      </div>

      {enabled && siteKey && !preview ? (
        <Turnstile
          ref={widget}
          siteKey={siteKey}
          onSuccess={setToken}
          onExpire={() => setToken("")}
          onError={() => {
            setToken("");
            setStatus("error");
            setMessage("La verifica anti-spam non è partita. Disattiva eventuali blocchi e riprova.");
            return true;
          }}
          options={{ theme: "light", size: "flexible", action: TURNSTILE_ACTION }}
        />
      ) : null}

      <label className="check-row" style={{ margin: "20px 0" }}>
        <input
          type="checkbox"
          checked={privacyAccepted}
          disabled={!enabled || status === "loading"}
          onChange={(event) => setPrivacyAccepted(event.target.checked)}
        />
        <span>
          Ho letto l’<Link href="/privacy">informativa privacy</Link> e acconsento al trattamento
          per inviare la domanda.
        </span>
      </label>

      {status === "error" && message ? (
        <p className="notice notice-error" role="alert">{message}</p>
      ) : null}

      <button className="button button-wide" type="submit" disabled={!enabled || status === "loading"}>
        {status === "loading" ? "Invio in corso…" : "Invia domanda"}
      </button>
    </form>
  );
}
