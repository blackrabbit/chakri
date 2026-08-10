import React, { useState } from "react";

export default function Auth({ onAuthenticated }) {
  const [registering, setRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const response = await fetch(`/api/auth/${registering ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, pin }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not sign in");
      onAuthenticated(data);
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }

  return <div className="home-page auth-page"><div className="home-card">
    <div className="brand-mark">♠</div><div className="eyebrow">★ PLAYER SELECT ★</div><h1>{registering ? "Create account" : "Welcome back"}</h1>
    <p className="home-subtitle">Use a username and PIN to keep your seat and name across devices.</p>
    <form className="home-form" onSubmit={submit}>
      <input className="modern-input" placeholder="Username (a-z, 0-9)" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} minLength={3} maxLength={20} autoComplete="username" required />
      <input className="modern-input" placeholder="PIN (4–8 letters or numbers)" value={pin} onChange={(e) => setPin(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8))} minLength={4} maxLength={8} autoComplete={registering ? "new-password" : "current-password"} required />
      {error && <div className="auth-error">{error}</div>}
      <button className="primary-action" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Sign in"} <span>→</span></button>
    </form>
    <button className="auth-switch" onClick={() => { setRegistering(!registering); setError(""); }}>{registering ? "Already have an account? Sign in" : "New player? Create an account"}</button>
    <div className="home-footnote">PINs are for casual play, not sensitive accounts.</div>
  </div></div>;
}
