"use client";

import { useRef, useState } from "react";
import { CANVAS_W, CANVAS_H } from "../../1vs1/constants";
import { useOnlineGame } from "../../online/useOnlineGame";

interface Props {
  matchId: number;
  onLeave: () => void;
}

export default function TournamentMatchCanvas({ matchId, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [over, setOver] = useState(false);

  const { ui, MAX_SCORE } = useOnlineGame(canvasRef, {
    tournamentMatchId: matchId,
    onGameOver: () => setOver(true),
  });

  const inGame = ["playing", "scored", "gameover", "paused"].includes(ui.phase);
  const youWon = over && ui.player !== null && ui.winner === ui.player;

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
      <div className="score-bar" style={{ opacity: inGame ? 1 : 0, transition: "opacity 0.3s" }}>
        <span className="score-player">P1 · ↑/↓</span>
        <span className="score-num">{ui.score1}</span>
        <span className="score-divider">–</span>
        <span className="score-num">{ui.score2}</span>
        <span className="score-player">↑/↓ · P2</span>
      </div>

      <div
        style={{
          border: "1px solid rgba(205,230,245,0.12)",
          borderRadius: "12px",
          overflow: "hidden",
          boxShadow: "0 0 60px rgba(54,130,127,0.15), 0 0 0 1px rgba(139,147,248,0.08)",
          width: "min(800px, 96vw)",
          aspectRatio: "800/500",
        }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          style={{ display: "block", width: "100%", height: "100%", background: "rgba(1,14,22,0.85)" }}
        />
      </div>

      <div style={{ width: "min(320px, 90vw)" }}>
        {over ? (
          <button
            className="btn-start"
            onClick={onLeave}
            onMouseDown={(e) => e.currentTarget.classList.add("active")}
            onMouseUp={(e) => { const b = e.currentTarget; setTimeout(() => b.classList.remove("active"), 150); }}
          >
            {youWon ? "VICTOIRE — RETOUR AU BRACKET" : "RETOUR AU BRACKET"}
          </button>
        ) : (
          <button className="btn-ghost" onClick={onLeave}>Abandonner</button>
        )}
      </div>

      <p className="tagline">
        {ui.phase === "waiting"
          ? "En attente de l'adversaire…"
          : `Tournoi · First to ${MAX_SCORE} · Tu es P${ui.player ?? "?"}`}
      </p>
    </div>
  );
}
