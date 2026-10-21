"use client";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Login failed");
      window.location.href = data.mustChangePassword ? "/change-password" : "/dashboard";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return <main style={{ maxWidth: 480 }}>
    <h1>Sign in</h1>
    <p>Use your college-issued CampusAttend account.</p>
    <form className="card" onSubmit={submit}>
      <label>Email address
        <input name="email" type="email" autoComplete="username" required maxLength={254} />
      </label>
      <label htmlFor="login-password">Password</label>
      <div className="password-field">
        <input id="login-password" name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={1} maxLength={200} />
        <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {showPassword ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11.4 11.4 0 0 1 12 5c5 0 8.5 4.5 9.5 7a12 12 0 0 1-3 4.2" /><path d="M6.2 6.2A13.2 13.2 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10.7 10.7 0 0 0 3.2-.5" /></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></>}
          </svg>
        </button>
      </div>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      <button disabled={busy} type="submit">{busy ? "Signing in…" : "Sign in"}</button>
      <p className="small">For security, you will be asked to set a new password the first time you sign in.</p>
    </form>
  </main>;
}
