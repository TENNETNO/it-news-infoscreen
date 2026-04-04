import { useState } from "react";

export function LoginScreen({ onLogin }) {
  const [passphrase, setPassphrase] = useState("");
  const [error,      setError]      = useState("");
  const [loading,    setLoading]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await onLogin(passphrase);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      setPassphrase("");
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <img className="login-logo" src="/mowi-logo.png" alt="Mowi" />

        <div className="login-heading">
          <div className="login-title">IT News Dashboard</div>
          <div className="login-sub">Office InfoScreen</div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="password"
            autoComplete="current-password"
            placeholder="Enter passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            disabled={loading}
            autoFocus
          />

          {error && <p className="login-error">{error}</p>}

          <button
            className="login-btn"
            type="submit"
            disabled={loading || !passphrase}
          >
            {loading ? "Verifying…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
