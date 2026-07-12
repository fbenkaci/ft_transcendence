"use client";

import { useRef } from "react";
import { CANVAS_W, CANVAS_H, MAX_SCORE } from "./constants";
import { Phase } from "./types";
import { useGameLoop, AiDifficulty } from "./useGameLoops";

type Props = {
  difficulte: AiDifficulty;
};

function startLabel(phase: Phase): string {
  if (phase === "idle") return "START";
  if (phase === "playing") return "PLAYING…";
  if (phase === "gameover") return "REPLAY";
  return "NEXT ROUND";
}


export default function PongCanvas({ difficulte }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { ui, handleStart } = useGameLoop(canvasRef, difficulte);

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
      <div className="score-bar">
        <span className="score-player">P1 · W/S</span>
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

      <div style={{ width: "min(320px, 90vw)" }}>
        <button
          className="btn-start"
          onClick={handleStart}
          onMouseDown={(e) => e.currentTarget.classList.add("active")}
          onMouseUp={(e) => {
            const btn = e.currentTarget;
            setTimeout(() => btn.classList.remove("active"), 150);
          }}
        >
          {startLabel(ui.phase)}
        </button>
      </div>

      {ui.phase === "gameover" && ui.winner && (
        <p
          className="subtitle"
          style={{ color: "rgba(205,230,245,0.6)", fontSize: "12px" }}
        >
          PLAYER {ui.winner} WINS THE MATCH
        </p>
      )}

      <p className="tagline">First to {MAX_SCORE} wins · Local 1v1</p>
    </div>
  );
}