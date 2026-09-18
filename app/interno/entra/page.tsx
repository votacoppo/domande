import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { hasAdminSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Accesso dashboard" };

export default async function LoginPage() {
  if (await hasAdminSession()) redirect("/interno/domande");
  return (
    <main className="auth-wrap">
      <div className="panel auth-panel">
        <p className="eyebrow">Area riservata</p>
        <h1 style={{ fontSize: "3rem" }}>Domande</h1>
        <LoginForm />
      </div>
    </main>
  );
}
