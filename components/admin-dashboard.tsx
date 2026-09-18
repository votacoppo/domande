"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveRequestCoordinator } from "@/lib/archive-request-coordinator";
import type { AdminSnapshot, ArchiveItem, QuestionAction, QuestionRow } from "@/lib/questions-types";

const EMPTY: AdminSnapshot = { pending: [], published: [], saved: [], rejected: [], archives: [] };
const BUCKET_LABELS: Record<ArchiveItem["admin_bucket"], string> = {
  pending: "In attesa",
  published: "In sala",
  saved: "Salvata",
  rejected: "Bocciata",
};

function when(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

type CardAction = { label: string; action: QuestionAction; kind?: "danger" | "success" };

function QuestionCards({ items, actions, actingId, onAction }: {
  items: QuestionRow[];
  actions: (item: QuestionRow, index: number) => CardAction[];
  actingId: string | null;
  onAction: (id: string, action: QuestionAction) => void;
}) {
  if (!items.length) return <p className="lede">Nessuna domanda.</p>;
  return (
    <ul className="card-list">
      {items.map((item, index) => (
        <li className="panel question-card" key={item.id}>
          <p className="question-copy">{item.question_text}</p>
          <p className="question-meta">
            Ricevuta {when(item.created_at)}
            {item.published_at ? ` · Pubblicata ${when(item.published_at)}` : ""}
            {item.rejected_at ? ` · Rimossa/bocciata ${when(item.rejected_at)}` : ""}
            {index === 0 && item.status === "published" ? " · In evidenza ora" : ""}
          </p>
          <div className="card-actions">
            {actions(item, index).map((entry) => (
              <button
                key={entry.action}
                type="button"
                className={`button button-small ${entry.kind === "danger" ? "button-danger" : entry.kind === "success" ? "button-success" : "button-secondary"}`}
                disabled={actingId === item.id}
                onClick={() => onAction(item.id, entry.action)}
              >
                {actingId === item.id ? "Attendi…" : entry.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboard({ reviewData }: { reviewData?: AdminSnapshot }) {
  const review = Boolean(reviewData);
  const [snapshot, setSnapshot] = useState(reviewData ?? EMPTY);
  const [loading, setLoading] = useState(!review);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [archiveName, setArchiveName] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [openArchive, setOpenArchive] = useState<string | null>(null);
  const [archiveItems, setArchiveItems] = useState<ArchiveItem[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveLoadError, setArchiveLoadError] = useState("");
  const inFlight = useRef(false);
  const archiveRequests = useRef(new ArchiveRequestCoordinator());

  const load = useCallback(async () => {
    if (review || inFlight.current || document.visibilityState === "hidden") return;
    inFlight.current = true;
    try {
      const response = await fetch(`/api/interno/domande?t=${Date.now()}`, { cache: "no-store" });
      const data = (await response.json()) as AdminSnapshot & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Caricamento non riuscito.");
        return;
      }
      setSnapshot(data);
      setError("");
    } catch {
      setError("Errore di rete. Riprovo automaticamente.");
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [review]);

  useEffect(() => {
    if (review) return;
    const firstLoad = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 2_000);
    const onVisibility = () => document.visibilityState === "visible" && void load();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(firstLoad);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [load, review]);

  useEffect(() => () => archiveRequests.current.cancel(), []);

  async function action(id: string, questionAction: QuestionAction) {
    if (review) return;
    if (questionAction === "delete_permanent" && !window.confirm("Eliminare definitivamente questa domanda?")) return;
    setActingId(id);
    setError("");
    try {
      const response = await fetch("/api/interno/domande", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: questionAction }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) setError(data.error ?? "Operazione non riuscita.");
      else await load();
    } catch {
      setError("Errore di rete.");
    } finally {
      setActingId(null);
    }
  }

  async function archiveAll() {
    if (review) return;
    const name = archiveName.trim();
    const total = snapshot.pending.length + snapshot.published.length + snapshot.saved.length + snapshot.rejected.length;
    if (!name) {
      setError("Inserisci un nome per l’archivio.");
      return;
    }
    if (!window.confirm(`Archiviare ${total} domande come “${name}” e svuotare la coda?`)) return;
    setArchiving(true);
    try {
      const response = await fetch("/api/interno/domande", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "archive_all", name }),
      });
      const data = (await response.json()) as { error?: string; questionCount?: number };
      if (!response.ok) setError(data.error ?? "Archiviazione non riuscita.");
      else {
        setMessage(`Archivio creato con ${data.questionCount ?? total} domande.`);
        setArchiveName("");
        await load();
      }
    } catch {
      setError("Errore di rete.");
    } finally {
      setArchiving(false);
    }
  }

  async function toggleArchive(id: string) {
    if (openArchive === id) {
      archiveRequests.current.cancel();
      setOpenArchive(null);
      setArchiveItems([]);
      setArchiveLoading(false);
      setArchiveLoadError("");
      return;
    }
    archiveRequests.current.cancel();
    setOpenArchive(id);
    setArchiveItems([]);
    setArchiveLoading(false);
    setArchiveLoadError("");
    if (review) {
      return;
    }
    const request = archiveRequests.current.begin();
    setArchiveLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/interno/domande?archiveId=${encodeURIComponent(id)}`, {
        cache: "no-store",
        signal: request.signal,
      });
      const data = (await response.json()) as { items?: ArchiveItem[]; error?: string };
      if (!request.isCurrent()) return;
      if (!response.ok) setArchiveLoadError(data.error ?? "Archivio non disponibile.");
      else setArchiveItems(data.items ?? []);
    } catch (archiveError) {
      if (request.isCurrent() && !(archiveError instanceof DOMException && archiveError.name === "AbortError")) {
        setArchiveLoadError("Errore di rete durante l’apertura dell’archivio.");
      }
    } finally {
      if (request.isCurrent()) setArchiveLoading(false);
    }
  }

  async function removeArchive(id: string, name: string) {
    if (review || !window.confirm(`Eliminare definitivamente l’archivio “${name}” e tutte le sue domande?`)) return;
    setActingId(id);
    setError("");
    try {
      const response = await fetch("/api/interno/domande", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete_archive" }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Eliminazione archivio non riuscita.");
      } else {
        if (openArchive === id) {
          archiveRequests.current.cancel();
          setOpenArchive(null);
          setArchiveItems([]);
          setArchiveLoading(false);
          setArchiveLoadError("");
        }
        setMessage(`Archivio “${name}” eliminato.`);
        await load();
      }
    } catch {
      setError("Errore di rete.");
    } finally {
      setActingId(null);
    }
  }

  if (loading) return <p className="lede">Caricamento domande…</p>;
  return (
    <div className="admin-grid">
      {review ? <p className="notice notice-info">Anteprima visiva: le azioni sono disattivate.</p> : null}
      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      {message ? <p className="notice notice-success" role="status">{message}</p> : null}

      <section className="panel archive-box">
        <h3>Archivia incontro</h3>
        <p className="lede">Salva uno snapshot e svuota la coda per il prossimo evento.</p>
        <div className="archive-form">
          <label className="field" style={{ margin: 0 }}>
            <span className="label">Nome archivio</span>
            <input className="input" value={archiveName} maxLength={120} placeholder="Es. Asti — 18 settembre 2026" onChange={(event) => setArchiveName(event.target.value)} />
          </label>
          <button className="button" type="button" disabled={review || archiving} onClick={() => void archiveAll()}>{archiving ? "Archivio…" : "Archivia tutto"}</button>
        </div>
      </section>

      <section className="admin-section">
        <div className="section-heading"><h2>In attesa</h2><span className="count">{snapshot.pending.length}</span></div>
        <QuestionCards items={snapshot.pending} actingId={actingId} onAction={(id, value) => void action(id, value)} actions={() => [
          { label: "Pubblica", action: "publish", kind: "success" },
          { label: "Boccia", action: "reject" },
          { label: "Elimina", action: "delete_permanent", kind: "danger" },
        ]} />
      </section>

      <section className="admin-section">
        <div className="section-heading"><h2>In sala</h2><span className="count">{snapshot.published.length}</span></div>
        <QuestionCards items={snapshot.published} actingId={actingId} onAction={(id, value) => void action(id, value)} actions={(_item, index) => [
          ...(index > 0 ? [{ label: "Rimetti in evidenza", action: "highlight" as const }] : []),
          { label: "Rimuovi da sala", action: "unpublish" as const },
        ]} />
      </section>

      <section className="admin-section">
        <div className="section-heading"><h2>Salvate</h2><span className="count">{snapshot.saved.length}</span></div>
        <QuestionCards items={snapshot.saved} actingId={actingId} onAction={(id, value) => void action(id, value)} actions={() => [
          { label: "Ripubblica", action: "republish", kind: "success" },
          { label: "Elimina", action: "delete_permanent", kind: "danger" },
        ]} />
      </section>

      <section className="admin-section">
        <div className="section-heading"><h2>Bocciate</h2><span className="count">{snapshot.rejected.length}</span></div>
        <QuestionCards items={snapshot.rejected} actingId={actingId} onAction={(id, value) => void action(id, value)} actions={() => [
          { label: "Elimina", action: "delete_permanent", kind: "danger" },
        ]} />
      </section>

      <section className="panel archive-box">
        <h2>Archivi</h2>
        {!snapshot.archives.length ? <p className="lede">Nessun archivio.</p> : snapshot.archives.map((archive) => (
          <div className="archive-row" key={archive.id}>
            <div className="archive-heading">
              <button className="archive-toggle" type="button" onClick={() => void toggleArchive(archive.id)}>
                <span>{archive.name}</span><span>{archive.question_count} domande · {when(archive.created_at)}</span>
              </button>
              <button
                className="button button-small button-danger"
                type="button"
                disabled={review || actingId === archive.id}
                onClick={() => void removeArchive(archive.id, archive.name)}
              >
                {actingId === archive.id ? "Attendi…" : "Elimina archivio"}
              </button>
            </div>
            {openArchive === archive.id ? (
              <div className="archive-items">
                {review ? <p className="lede">Contenuto archivio disponibile nella versione collegata al database.</p> : archiveItems.map((item) => (
                  <div className="archive-item" key={item.id}>
                    <p className="question-copy">{item.question_text}</p>
                    <p className="question-meta">
                      {BUCKET_LABELS[item.admin_bucket]} · Ricevuta {when(item.created_at)}
                      {item.published_at ? ` · Pubblicata ${when(item.published_at)}` : ""}
                      {item.rejected_at ? ` · Rimossa/bocciata ${when(item.rejected_at)}` : ""}
                    </p>
                  </div>
                ))}
                {!review && archiveLoading ? <p className="lede">Caricamento archivio…</p> : null}
                {!review && archiveLoadError ? <p className="notice notice-error">{archiveLoadError}</p> : null}
                {!review && !archiveLoading && !archiveLoadError && !archiveItems.length ? <p className="lede">Archivio vuoto.</p> : null}
              </div>
            ) : null}
          </div>
        ))}
      </section>
    </div>
  );
}
