import { useCallback, useEffect, useState } from "react";

// status: "loading" | "authenticated" | "unauthenticated"
export function useAuth() {
  const [status, setStatus] = useState("loading");

  // Check existing session on mount
  useEffect(() => {
    fetch("/auth/status")
      .then((res) => setStatus(res.ok ? "authenticated" : "unauthenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  const login = useCallback(async (passphrase) => {
    try {
      const res  = await fetch("/auth/login", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ passphrase })
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setStatus("authenticated");
        return { ok: true };
      }
      return { ok: false, message: data.message ?? "Login failed." };
    } catch {
      return { ok: false, message: "Network error. Please try again." };
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch("/auth/logout", { method: "POST" }).catch(() => {});
    setStatus("unauthenticated");
  }, []);

  return { status, login, logout };
}
