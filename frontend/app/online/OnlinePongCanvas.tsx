"use client";

import { useRef } from "react";
import { CANVAS_W, CANVAS_H, MAX_SCORE } from "../1vs1/constants";
import { useOnlineGame } from "./useOnlineGame";

export default function OnlinePongCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ui, findMatch, requestRematch, reconnect } = useOnlineGame(canvasRef);

  const inGame = ["playing", "scored", "gameover", "disconnected"].includes(ui.phase);

  return (
    <div
      style={{
        position: "relative",
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.2rem",
        width: "100%",
      }}
    >
      {/* Score bar — visible dès qu'une partie est en cours */}
      <div className="score-bar" style={{ opacity: inGame ? 1 : 0, transition: "opacity 0.3s" }}>
        <span className="score-player">P1 · ↑/↓</span>
        <span className="score-num">{ui.score1}</span>
        <span className="score-divider">–</span>
        <span className="score-num">{ui.score2}</span>
        <span className="score-player">↑/↓ · P2</span>
      </div>

      {/* Canvas — toujours monté pour que le RAF dessine les overlays */}
      <div
        style={{
          border: "1px solid rgba(205,230,245,0.12)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow:
            "0 0 60px rgba(54,130,127,0.15), 0 0 0 1px rgba(139,147,248,0.08)",
          width: "min(800px, 96vw)",
          aspectRatio: "800/500",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            background: "rgba(1,14,22,0.85)",
          }}
        />
      </div>

      {/* Bouton principal */}
      <div style={{ width: "min(320px, 90vw)" }}>
        {ui.phase === "idle" && (
          <button
            className="btn-start"
            onClick={findMatch}
            onMouseDown={(e) => e.currentTarget.classList.add("active")}
            onMouseUp={(e) => {
              const btn = e.currentTarget;
              setTimeout(() => btn.classList.remove("active"), 150);
            }}
          >
            PLAY ONLINE
          </button>
        )}
        {ui.phase === "gameover" && (
          <button
            className="btn-start"
            onClick={requestRematch}
            onMouseDown={(e) => e.currentTarget.classList.add("active")}
            onMouseUp={(e) => {
              const btn = e.currentTarget;
              setTimeout(() => btn.classList.remove("active"), 150);
            }}
          >
            REMATCH
          </button>
        )}
        {ui.phase === "disconnected" && (
          <button
            className="btn-start"
            onClick={reconnect}
            onMouseDown={(e) => e.currentTarget.classList.add("active")}
            onMouseUp={(e) => {
              const btn = e.currentTarget;
              setTimeout(() => btn.classList.remove("active"), 150);
            }}
          >
            FIND NEW GAME
          </button>
        )}
      </div>

      <p className="tagline">
        {inGame
          ? `First to ${MAX_SCORE} · Online 1v1`
          : "Online 1v1 · Use ↑/↓ to move"}
      </p>
    </div>
  );
}
