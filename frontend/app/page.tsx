"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function Page() {
  const ballsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  const handleStartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    
    if (token && token !== "undefined" && token !== "null") {
      router.push("/start");
    } else {
      router.push("/login");
    }
  };

  return (
    <main className="tr-wrap">
      <div ref={ballsRef} className="balls-layer" aria-hidden="true">
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
            <ellipse
              cx="22"
              cy="16"
              rx="12"
              ry="12"
              stroke="#CDE6F5"
              strokeWidth="2.2"
              fill="none"
              opacity="0.9"
            />
            <line
              x1="22"
              y1="28"
              x2="22"
              y2="42"
              stroke="#CDE6F5"
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.85"
            />
            <line
              x1="14"
              y1="16"
              x2="30"
              y2="16"
              stroke="#CDE6F5"
              strokeWidth="1.2"
              opacity="0.25"
            />
            <line
              x1="22"
              y1="8"
              x2="22"
              y2="24"
              stroke="#CDE6F5"
              strokeWidth="1.2"
              opacity="0.25"
            />
          </svg>

          <h1 className="title">TRANSCENDENCE</h1>
        </div>

        <p className="subtitle">42 · Pong · Multiplayer</p>

        <div className="score-bar">
          <span className="score-player">P1</span>
          <span className="score-num">0</span>
          <span className="score-divider">—</span>
          <span className="score-num">0</span>
          <span className="score-player">P2</span>
        </div>

        <div className="btn-group">
          <Link href="/start" id="start-btn" className="btn-start" onClick={handleStartClick}>
            START
          </Link>
          <div className="btn-row">
            <Link href="/login" className="btn-ghost">
              Login
            </Link>
            <Link href="/signup" className="btn-ghost">
              Sign in
            </Link>
          </div>
        </div>

        <p className="tagline">First to 11 wins · Best of 3</p>
      </div>
    </main>
  );
}
