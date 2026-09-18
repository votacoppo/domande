"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      className="button button-secondary button-small"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          await fetch("/api/interno/auth/logout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
          });
        } finally {
          router.push("/interno/entra");
          router.refresh();
        }
      }}
    >
      {loading ? "Uscita…" : "Esci"}
    </button>
  );
}
