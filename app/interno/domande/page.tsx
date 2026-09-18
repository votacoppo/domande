import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { LogoutButton } from "@/components/logout-button";
import { hasAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gestione domande" };

export default async function AdminQuestionsPage() {
  if (!(await hasAdminSession())) redirect("/interno/entra");
  return (
    <main className="page">
      <div className="shell">
        <header className="admin-header">
          <div>
            <p className="eyebrow">Dashboard privata</p>
            <h1 style={{ marginBottom: 8 }}>Domande</h1>
            <p className="lede">Modera ciò che compare sullo schermo in sala.</p>
          </div>
          <div className="admin-actions">
            <Link className="button button-secondary button-small" href="/QeA" target="_blank">Apri schermo</Link>
            <LogoutButton />
          </div>
        </header>
        <AdminDashboard />
      </div>
    </main>
  );
}
