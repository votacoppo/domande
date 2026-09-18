"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublishedQuestion } from "@/lib/questions-types";

function sameQuestions(current: PublishedQuestion[], next: PublishedQuestion[]): boolean {
  return current.length === next.length && current.every((item, index) => {
    const other = next[index];
    return other && item.id === other.id && item.question_text === other.question_text && item.published_at === other.published_at;
  });
}

export function QuestionWall({ initialQuestions }: { initialQuestions: PublishedQuestion[] }) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [offline, setOffline] = useState(false);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState === "hidden") return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/domande/published?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) {
        setOffline(true);
        return;
      }
      const data = (await response.json()) as { questions?: PublishedQuestion[] };
      const next = data.questions ?? [];
      setQuestions((current) => sameQuestions(current, next) ? current : next);
      setOffline(false);
    } catch {
      setOffline(true);
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => void refresh(), 1_000);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const latest = questions[0];
  const latestLength = latest ? Array.from(latest.question_text).length : 0;
  const densityClass = latestLength > 360
    ? "featured-text--xlong"
    : latestLength > 220
      ? "featured-text--long"
      : latestLength > 120
        ? "featured-text--medium"
        : "";
  return (
    <section className="wall" aria-live="polite">
      {offline ? <p className="notice notice-info">Connessione in ripristino: resta visibile l’ultimo aggiornamento.</p> : null}
      {!latest ? (
        <div className="panel empty-wall">
          <div>
            <span className="empty-mark" aria-hidden="true">?</span>
            <h2 style={{ marginTop: 18 }}>In attesa della prima domanda</h2>
          </div>
        </div>
      ) : (
        <>
          <article className="panel featured">
            <p className="featured-label">Domanda in evidenza</p>
            <p className={`featured-text ${densityClass}`}>{latest.question_text}</p>
          </article>
          {questions.length > 1 ? (
            <ul className="question-list" aria-label="Domande precedenti">
              {questions.slice(1).map((question) => (
                <li className="question-item" key={question.id}>{question.question_text}</li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
