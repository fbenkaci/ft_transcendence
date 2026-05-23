"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const btn = document.getElementById("start-btn");
    if (!btn) return;
    const handleActive = () => {
      btn.classList.add("active");
      setTimeout(() => btn.classList.remove("active"), 150);
    };
    btn.addEventListener("mousedown", handleActive);
    return () => btn.removeEventListener("mousedown", handleActive);
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/api/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });

      if (res.ok) {
        router.push("/login");
      } else {
        const data = await res.json();
        setError(JSON.stringify(data));
      }
    } catch (err) {
      setError("Erreur de connexion au serveur.");
    }
  };

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="net" aria-hidden="true" />

      <div className="content">
        <div className="title-row">
          <svg
            className="racket-svg"
            width="48"
            height="48"
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <ellipse cx="19" cy="19" rx="14" ry="14" stroke="#CDE6F5" strokeWidth="2.2" fill="none" opacity="0.9" />
            <line x1="19" y1="5" x2="19" y2="33" stroke="#CDE6F5" strokeWidth="1.2" opacity="0.4" />
            <line x1="5" y1="19" x2="33" y2="19" stroke="#CDE6F5" strokeWidth="1.2" opacity="0.4" />
            <line x1="9" y1="9" x2="29" y2="29" stroke="#CDE6F5" strokeWidth="1" opacity="0.25" />
            <line x1="29" y1="9" x2="9" y2="29" stroke="#CDE6F5" strokeWidth="1" opacity="0.25" />
            <line x1="26" y1="30" x2="38" y2="42" stroke="#CDE6F5" strokeWidth="3" strokeLinecap="round" opacity="0.85" />
          </svg>
          <h1 className="title">Login</h1>
        </div>

        {error && <p style={{ color: "var(--destructive)", fontSize: "14px", marginBottom: "-10px" }}>{error}</p>}

        <form onSubmit={handleSignup} style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem" }}>
          <div className="input-group">
            <input
              type="text"
              placeholder="Username"
              className="tr-input"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="email"
              placeholder="Email"
              className="tr-input"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              placeholder="Password"
              className="tr-input"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div className="btn-group">
            <button type="submit" id="start-btn" className="btn-start">
              Create account
            </button>
            <div className="btn-row">
              <Link href="/login" className="btn-ghost">
                Login
              </Link>
              <Link href="/signup" className="btn-ghost">
                Sign in
              </Link>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
