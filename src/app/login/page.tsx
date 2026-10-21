"use client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      window.location.href = "/dashboard";
    } catch (e) { setError(e instanceof Error ? e.message : "Login failed"); }
    finally { setBusy(false); }
  }
  return <main style={{maxWidth:480}}>
    <h1>Sign in</h1><p>Use your college-issued CampusAttend account.</p>
    <form className="card" onSubmit={submit}>
      <label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required minLength={1} maxLength={200}/></label>
      {error && <p role="alert" style={{color:"#b91c1c"}}>{error}</p>}
      <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="small">Account creation is administrator-controlled. Password reset and email verification must be configured before launch.</p>
    </form>
  </main>;
}
