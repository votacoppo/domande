import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import type { AdminSnapshot } from "@/lib/questions-types";

const now = new Date("2026-09-18T10:30:00+02:00").toISOString();
const reviewData: AdminSnapshot = {
  pending: [{ id: "1", question_text: "Quali iniziative concrete porterà avanti per il lavoro dei giovani ad Asti?", status: "pending", created_at: now, published_at: null, rejected_at: null }],
  published: [
    { id: "2", question_text: "Come possono istituzioni e imprese collaborare sulla formazione digitale?", status: "published", created_at: now, published_at: now, rejected_at: null },
    { id: "3", question_text: "Qual è la priorità per la sicurezza nei luoghi di lavoro?", status: "published", created_at: now, published_at: now, rejected_at: null },
  ],
  saved: [{ id: "4", question_text: "Che ruolo può avere l’innovazione per le aziende del territorio?", status: "rejected", created_at: now, published_at: now, rejected_at: now }],
  rejected: [{ id: "5", question_text: "Esempio di domanda non selezionata.", status: "rejected", created_at: now, published_at: null, rejected_at: now }],
  archives: [{ id: "a", name: "Incontro di prova — Asti", created_at: now, question_count: 12 }],
};

export default function ReviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <main className="page"><div className="shell"><h1>Anteprima dashboard</h1><AdminDashboard reviewData={reviewData} /></div></main>;
}
