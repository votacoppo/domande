"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/interno/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await response.json()) as { error?: string; redirect?: string };
      if (!response.ok) {
        setError(data.error ?? "Email o password non corretti.");
        return;
      }
      router.push(data.redirect ?? "/interno/domande");
      router.refresh();
    } catch {
      setError("Accesso non riuscito. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} disabled={loading} />
      </div>
      {error ? <p className="notice notice-error" role="alert">{error}</p> : null}
      <button className="button button-wide" type="submit" disabled={loading}>{loading ? "Accesso…" : "Accedi"}</button>
    </form>
  );
}
