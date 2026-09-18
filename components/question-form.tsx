"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { QUESTION_MAX_LENGTH, QUESTION_MIN_LENGTH, TURNSTILE_ACTION } from "@/lib/config";

export function QuestionForm({ enabled, siteKey }: { enabled: boolean; siteKey: string }) {
  const [questionText, setQuestionText] = useState("");
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

      {enabled && siteKey ? (
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
          Ho letto e accetto l’<Link href="/privacy">informativa privacy</Link>.
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
