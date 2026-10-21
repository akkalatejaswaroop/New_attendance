"use client";

import { FormEvent, useState } from "react";

export default function ChangePasswordPage() {
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: form.get("currentPassword"),
          newPassword: form.get("newPassword"),
          confirmPassword: form.get("confirmPassword")
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to change password");
      setSuccess("Password updated. Opening your dashboard…");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to change password");
    } finally {
      setBusy(false);
    }
  }

  const eye = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {showPasswords ? <><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 5.2A11.4 11.4 0 0 1 12 5c5 0 8.5 4.5 9.5 7a12 12 0 0 1-3 4.2" /><path d="M6.2 6.2A13.2 13.2 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a10.7 10.7 0 0 0 3.2-.5" /></> : <><path d="M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>;

  return <main style={{ maxWidth: 520 }}>
    <h1>Set your new password</h1>
    <p>For account security, change your temporary password before using CampusAttend.</p>
    <form className="card" onSubmit={submit}>
      <label htmlFor="currentPassword">Current temporary password</label>
      <div className="password-field">
        <input id="currentPassword" name="currentPassword" type={showPasswords ? "text" : "password"} autoComplete="current-password" required maxLength={200} />
        <button className="password-toggle" type="button" onClick={() => setShowPasswords(value => !value)} aria-label={showPasswords ? "Hide passwords" : "Show passwords"} title={showPasswords ? "Hide passwords" : "Show passwords"}>{eye}</button>
      </div>
      <label htmlFor="newPassword">New password</label>
      <input id="newPassword" name="newPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" required minLength={14} maxLength={200} />
      <label htmlFor="confirmPassword">Confirm new password</label>
      <input id="confirmPassword" name="confirmPassword" type={showPasswords ? "text" : "password"} autoComplete="new-password" required minLength={14} maxLength={200} />
      <p className="small">Use at least 14 characters with uppercase and lowercase letters, a number, and a symbol. Your password is stored as a secure hash, never as plain text.</p>
      {error && <p role="alert" style={{ color: "#b91c1c" }}>{error}</p>}
      {success && <p role="status" style={{ color: "#166534" }}>{success}</p>}
      <button type="submit" disabled={busy}>{busy ? "Updating password…" : "Update password"}</button>
    </form>
  </main>;
}
