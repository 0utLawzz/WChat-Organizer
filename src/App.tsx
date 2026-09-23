import { useEffect, useState } from "react";

const AUTH_KEY = "marque-nb-auth";
const APP_PASSWORD = "brandex2026";

export default function App() {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem(AUTH_KEY) === "1",
  );
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  if (authed) {
    return (
      <div style={{ padding: 40, fontFamily: "system-ui", maxWidth: 560 }}>
        <h1>BrandEx Workspace</h1>
        <p>
          Production <code>App.tsx</code> needs a re-upload (automated push of the
          ~108KB file hit a size limit).
        </p>
        <ol>
          <li>
            Download the production file from the chat (App.tsx.production).
          </li>
          <li>
            Open{" "}
            <a href="https://github.com/0utLawzz/WChat-Organizer/upload/main/src">
              github.com/0utLawzz/WChat-Organizer/upload/main/src
            </a>
          </li>
          <li>
            Drop the file, name it <code>App.tsx</code>, commit message:
            <br />
            <code>ui: Database Store structured cards instead of raw JSON</code>
          </li>
        </ol>
        <button
          type="button"
          onClick={() => {
            sessionStorage.removeItem(AUTH_KEY);
            setAuthed(false);
          }}
          style={{ marginTop: 16, padding: "8px 16px" }}
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#F0E8D0",
        fontFamily: "system-ui",
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === APP_PASSWORD) {
            sessionStorage.setItem(AUTH_KEY, "1");
            setAuthed(true);
          } else setError("Incorrect password");
        }}
        style={{
          background: "#FAF6EE",
          border: "3px solid #0C0C0C",
          boxShadow: "5px 5px 0 #0C0C0C",
          padding: 32,
          width: 360,
        }}
      >
        <h1 style={{ marginTop: 0 }}>BRANDEX.</h1>
        <p style={{ opacity: 0.6, fontSize: 14 }}>Enter password to unlock</p>
        <input
          type="password"
          value={pw}
          onChange={(e) => {
            setPw(e.target.value);
            setError("");
          }}
          placeholder="Password"
          style={{
            width: "100%",
            padding: 10,
            border: "2px solid #0C0C0C",
            marginBottom: 12,
            boxSizing: "border-box",
          }}
          autoFocus
        />
        {error && (
          <p style={{ color: "#C94A00", fontSize: 14 }}>{error}</p>
        )}
        <button
          type="submit"
          style={{
            width: "100%",
            padding: 12,
            background: "#C94A00",
            color: "#fff",
            border: "2px solid #0C0C0C",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
