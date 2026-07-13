"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CANVAS_W,
  CANVAS_H,
  PADDLE_W,
  PADDLE_H,
  BALL_SIZE,
  PADDLE_SPEED,
  MAX_SCORE,
  PADDLE_MARGIN,
} from "./constants";
import { GameState, Phase, makeInitialState, launchBall } from "./types";

export interface GameUI {
  score1: number;
  score2: number;
  phase: Phase;
  winner: 1 | 2 | null;
}

export enum AiDifficulty {
  EASY = 'easy',
  MEDIUM = "medium",
  HARD = "hard"
};

export function useGameLoop(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  difficulte: AiDifficulty = AiDifficulty.EASY
) {
  const stateRef = useRef<GameState>(makeInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const rafRef = useRef<number>(0);
  

  const [ui, setUI] = useState<GameUI>({
    score1: 0,
    score2: 0,
    phase: "idle",
    winner: null,
  });

  const syncUI = useCallback(() => {
    const s = stateRef.current;
    setUI({ score1: s.score1, score2: s.score2, phase: s.phase, winner: s.winner });
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "rgba(205,230,245,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    const drawPaddle = (x: number, y: number) => {
      const grad = ctx.createLinearGradient(x, y, x + PADDLE_W, y + PADDLE_H);
      grad.addColorStop(0, "rgba(139,147,248,0.9)");
      grad.addColorStop(1, "rgba(54,130,127,0.9)");
      ctx.fillStyle = grad;
      ctx.shadowColor = "rgba(139,147,248,0.5)";
      ctx.shadowBlur = 14;
      const r = 6;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + PADDLE_W - r, y);
      ctx.quadraticCurveTo(x + PADDLE_W, y, x + PADDLE_W, y + r);
      ctx.lineTo(x + PADDLE_W, y + PADDLE_H - r);
      ctx.quadraticCurveTo(x + PADDLE_W, y + PADDLE_H, x + PADDLE_W - r, y + PADDLE_H);
      ctx.lineTo(x + r, y + PADDLE_H);
      ctx.quadraticCurveTo(x, y + PADDLE_H, x, y + PADDLE_H - r);
      ctx.lineTo(x, y + r);
      ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    };

    drawPaddle(PADDLE_MARGIN, s.p1y);
    drawPaddle(CANVAS_W - PADDLE_MARGIN - PADDLE_W, s.p2y);

    ctx.fillStyle = "#CDE6F5";
    ctx.shadowColor = "rgba(205,230,245,0.8)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(s.bx, s.by, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.textAlign = "center";
    if (s.phase === "idle") {
      ctx.fillStyle = "rgba(205,230,245,0.2)";
      ctx.font = "700 15px Orbitron, monospace";
      ctx.fillText("PRESS START", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (s.phase === "scored") {
      ctx.fillStyle = "rgba(205,230,245,0.35)";
      ctx.font = "700 13px Orbitron, monospace";
      ctx.fillText("PRESS START TO CONTINUE", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (s.phase === "gameover" && s.winner) {
      ctx.fillStyle = "rgba(205,230,245,0.45)";
      ctx.font = "700 20px Orbitron, monospace";
      ctx.fillText(`PLAYER ${s.winner} WINS`, CANVAS_W / 2, CANVAS_H / 2 - 10);
      ctx.font = "600 12px Orbitron, monospace";
      ctx.fillStyle = "rgba(205,230,245,0.25)";
      ctx.fillText("PRESS START TO REPLAY", CANVAS_W / 2, CANVAS_H / 2 + 18);
    }
  }, [canvasRef]);

  const p2IsAI = true;
  const tick = useCallback(() => {
    const s = stateRef.current;
    const keys = keysRef.current;

    if (s.phase === "playing") {
      if (keys.has("w") || keys.has("W"))
        s.p1y = Math.max(0, s.p1y - PADDLE_SPEED);
      if (keys.has("s") || keys.has("S"))
        s.p1y = Math.min(CANVAS_H - PADDLE_H, s.p1y + PADDLE_SPEED);
      
      //partie IA
      if (!p2IsAI) {
        if (keys.has("ArrowUp")) s.p2y = Math.max(0, s.p2y - PADDLE_SPEED);
        if (keys.has("ArrowDown")) s.p2y = Math.min(CANVAS_H - PADDLE_H, s.p2y + PADDLE_SPEED);
      } else {
        const aiSpeedFactor =
          difficulte === AiDifficulty.EASY
            ? 0.5
            : difficulte === AiDifficulty.HARD
            ? 0.9
            : 0.75;
        const AI_SPEED = PADDLE_SPEED * aiSpeedFactor;
        const paddleCenter = s.p2y + PADDLE_H / 2;
        if (s.by < paddleCenter - 4) s.p2y = Math.max(0, s.p2y - AI_SPEED);
        else if (s.by > paddleCenter + 4) s.p2y = Math.min(CANVAS_H - PADDLE_H, s.p2y + AI_SPEED);
      }
    
      s.bx += s.vx;
      s.by += s.vy;

      if (s.by - BALL_SIZE / 2 <= 0) { s.by = BALL_SIZE / 2; s.vy *= -1; }
      if (s.by + BALL_SIZE / 2 >= CANVAS_H) { s.by = CANVAS_H - BALL_SIZE / 2; s.vy *= -1; }

      const p1EdgeRight = PADDLE_MARGIN + PADDLE_W;
      if (
        s.bx - BALL_SIZE / 2 <= p1EdgeRight &&
        s.bx - BALL_SIZE / 2 >= PADDLE_MARGIN &&
        s.by >= s.p1y &&
        s.by <= s.p1y + PADDLE_H &&
        s.vx < 0
      ) {
        const hitPos = (s.by - s.p1y) / PADDLE_H - 0.5;
        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy) * 1.04;
        const angle = hitPos * (Math.PI / 3);
        s.vx = Math.abs(speed * Math.cos(angle));
        s.vy = speed * Math.sin(angle);
        s.bx = p1EdgeRight + BALL_SIZE / 2;
      }

      const p2x = CANVAS_W - PADDLE_MARGIN - PADDLE_W;
      if (
        s.bx + BALL_SIZE / 2 >= p2x &&
        s.bx + BALL_SIZE / 2 <= p2x + PADDLE_W &&
        s.by >= s.p2y &&
        s.by <= s.p2y + PADDLE_H &&
        s.vx > 0
      ) {
        const hitPos = (s.by - s.p2y) / PADDLE_H - 0.5;
        const speed = Math.sqrt(s.vx * s.vx + s.vy * s.vy) * 1.04;
        const angle = hitPos * (Math.PI / 3);
        s.vx = -Math.abs(speed * Math.cos(angle));
        s.vy = speed * Math.sin(angle);
        s.bx = p2x - BALL_SIZE / 2;
      }

      if (s.bx < 0) {
        s.score2++;
        s.bx = CANVAS_W / 2;
        s.by = CANVAS_H / 2;
        s.vx = 0;
        s.vy = 0;
        s.phase = s.score2 >= MAX_SCORE ? "gameover" : "scored";
        if (s.phase === "gameover") s.winner = 2;
        syncUI();
      } else if (s.bx > CANVAS_W) {
        s.score1++;
        s.bx = CANVAS_W / 2;
        s.by = CANVAS_H / 2;
        s.vx = 0;
        s.vy = 0;
        s.phase = s.score1 >= MAX_SCORE ? "gameover" : "scored";
        if (s.phase === "gameover") s.winner = 1;
        syncUI();
      }
    }

    draw();
    rafRef.current = requestAnimationFrame(tick);
  }, [draw, syncUI, difficulte]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key);
    };
    const offKey = (e: KeyboardEvent) => keysRef.current.delete(e.key);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", offKey);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", offKey);
    };
  }, [tick]);

  const handleStart = useCallback(() => {
    const s = stateRef.current;
    if (s.phase === "gameover") {
      stateRef.current = makeInitialState();
      syncUI();
      return;
    }
    const { vx, vy } = launchBall(s.score1 <= s.score2);
    stateRef.current.vx = vx;
    stateRef.current.vy = vy;
    stateRef.current.bx = CANVAS_W / 2;
    stateRef.current.by = CANVAS_H / 2;
    stateRef.current.phase = "playing";
    syncUI();
  }, [syncUI]);

  return { ui, handleStart };
}