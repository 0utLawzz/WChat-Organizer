import { useState } from "react";
import { Lock } from "lucide-react";

const APP_PASSWORD = "brandex2026";
const AUTH_KEY = "marque-nb-auth";

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === APP_PASSWORD) {
      sessionStorage.setItem(AUTH_KEY, "1");
      onSuccess();
    } else {
      setError("Incorrect password");
    }
  }
  return (
    <div className="theme-neobrutalism flex min-h-screen items-center justify-center p-6" style={{ background: "var(--bg)" }}>
      <div className="nb-panel w-full max-w-md p-8">
        <h1 className="mb-4 text-center text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          MARQUE<span style={{ color: "var(--accent)" }}>.</span>
        </h1>
        <p className="mb-4 text-center text-sm opacity-60">Deploy recovery in progress. Re-push full app shortly.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="password" className="nb-input" placeholder="Password" value={pw} onChange={(e) => { setPw(e.target.value); setError(""); }} autoFocus />
          {error && <p className="text-sm" style={{ color: "var(--accent)" }}>{error}</p>}
          <button type="submit" className="nb-btn w-full"><Lock size={14} /> Unlock</button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === "1");
  if (!authed) return <LoginGate onSuccess={() => setAuthed(true)} />;
  return (
    <div className="theme-neobrutalism min-h-screen p-8" style={{ background: "var(--bg)" }}>
      <h1 className="text-3xl" style={{ fontFamily: "var(--font-display)" }}>MARQUE.</h1>
      <p className="mt-4">Full desk is being restored. Please refresh in a few minutes.</p>
      <button className="nb-btn mt-4" onClick={() => { sessionStorage.removeItem(AUTH_KEY); setAuthed(false); }}>Logout</button>
    </div>
  );
}
