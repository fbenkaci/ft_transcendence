"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  CANVAS_W, CANVAS_H, PADDLE_W, PADDLE_H,
  BALL_SIZE, PADDLE_MARGIN, MAX_SCORE,
} from "../1vs1/constants";

export type OnlinePhase =
  | "idle" | "waiting" | "playing" | "scored"
  | "gameover" | "disconnected" | "paused";

interface RemoteState {
  p1y: number;
  p2y: number;
  ball: { x: number; y: number };
  score1: number;
  score2: number;
  phase: string;
  winner: number | null;
}

export interface OnlineUI {
  phase: OnlinePhase;
  score1: number;
  score2: number;
  winner: 1 | 2 | null;
  player: 1 | 2 | null;
}

export interface OnlineGameOptions {
  tournamentMatchId?: number | null;
  onGameOver?: (winner: 1 | 2 | null) => void;
}

const initialRemote: RemoteState = {
  p1y: CANVAS_H / 2 - PADDLE_H / 2,
  p2y: CANVAS_H / 2 - PADDLE_H / 2,
  ball: { x: CANVAS_W / 2, y: CANVAS_H / 2 },
  score1: 0,
  score2: 0,
  phase: "idle",
  winner: null,
};

export function useOnlineGame(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  opts: OnlineGameOptions = {},
) {
  const wsRef = useRef<WebSocket | null>(null);
  const stateRef = useRef<RemoteState>({ ...initialRemote });
  const phaseRef = useRef<OnlinePhase>("idle");
  const rafRef = useRef<number>(0);
  const [wsKey, setWsKey] = useState(0);
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; });

  const [ui, setUI] = useState<OnlineUI>({
    phase: "idle", score1: 0, score2: 0, winner: null, player: null,
  });

  const updatePhase = useCallback((phase: OnlinePhase) => {
    phaseRef.current = phase;
    setUI(prev => prev.phase === phase ? prev : { ...prev, phase });
  }, []);

  // ── Draw (RAF) ──────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;
    const phase = phaseRef.current;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Ligne centrale
    ctx.setLineDash([14, 10]);
    ctx.strokeStyle = "rgba(205,230,245,0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CANVAS_W / 2, 0);
    ctx.lineTo(CANVAS_W / 2, CANVAS_H);
    ctx.stroke();
    ctx.setLineDash([]);

    // Raquettes
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

    // Balle
    ctx.fillStyle = "#CDE6F5";
    ctx.shadowColor = "rgba(205,230,245,0.8)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(s.ball.x, s.ball.y, BALL_SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Overlays texte
    ctx.textAlign = "center";
    if (phase === "idle") {
      ctx.fillStyle = "rgba(205,230,245,0.2)";
      ctx.font = "700 15px Orbitron, monospace";
      ctx.fillText("PRESS PLAY", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (phase === "waiting") {
      ctx.fillStyle = "rgba(205,230,245,0.2)";
      ctx.font = "700 15px Orbitron, monospace";
      ctx.fillText("SEARCHING…", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (phase === "scored") {
      ctx.fillStyle = "rgba(205,230,245,0.35)";
      ctx.font = "700 13px Orbitron, monospace";
      ctx.fillText("NEXT ROUND…", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (phase === "paused") {
      ctx.fillStyle = "rgba(248,191,113,0.5)";
      ctx.font = "700 14px Orbitron, monospace";
      ctx.fillText("OPPONENT LEFT — WAITING…", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
    if (phase === "gameover" && s.winner) {
      ctx.fillStyle = "rgba(205,230,245,0.45)";
      ctx.font = "700 20px Orbitron, monospace";
      ctx.fillText(`PLAYER ${s.winner} WINS`, CANVAS_W / 2, CANVAS_H / 2 - 10);
      if (!optsRef.current.tournamentMatchId) {
        ctx.font = "600 12px Orbitron, monospace";
        ctx.fillStyle = "rgba(205,230,245,0.25)";
        ctx.fillText("PRESS REMATCH", CANVAS_W / 2, CANVAS_H / 2 + 18);
      }
    }
    if (phase === "disconnected") {
      ctx.fillStyle = "rgba(248,113,113,0.5)";
      ctx.font = "700 14px Orbitron, monospace";
      ctx.fillText("OPPONENT DISCONNECTED", CANVAS_W / 2, CANVAS_H / 2 + 6);
    }
  }, [canvasRef]);

  const loop = useCallback(() => {
    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [loop]);

  // ── WebSocket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current = { ...initialRemote };
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const origin =
      window.location.protocol === "https:"
        ? window.location.host
        : `${window.location.hostname}:8000`;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const ws = new WebSocket(
      `${proto}://${origin}/ws/pong/${token ? `?token=${token}` : ""}`,
    );
    wsRef.current = ws;

    ws.onopen = () => {
      const matchId = optsRef.current.tournamentMatchId;
      if (matchId) {
        ws.send(JSON.stringify({ action: "join_tournament_match", match_id: matchId }));
        updatePhase("waiting");
      }
    };

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);

      if (data.type === "waiting") {
        updatePhase("waiting");
      }
      if (data.type === "match_found") {
        if (data.player === 1 || data.player === 2) {
          setUI(prev => ({ ...prev, player: data.player }));
        }
        updatePhase("playing");
      }
      if (data.type === "reconnected") {
        if (data.player === 1 || data.player === 2) {
          setUI(prev => ({ ...prev, player: data.player }));
        }
        if (data.state) stateRef.current = data.state;
        updatePhase("playing");
      }
      if (data.type === "paused" || data.type === "opponent_left") {
        updatePhase("paused");
      }
      if (data.type === "game_state") {
        stateRef.current = data.state;
        const incoming = data.state.phase as OnlinePhase;
        if (incoming !== phaseRef.current) updatePhase(incoming);
        setUI(prev => {
          if (
            prev.score1 === data.state.score1 &&
            prev.score2 === data.state.score2 &&
            prev.winner === data.state.winner
          ) return prev;
          return { ...prev, score1: data.state.score1, score2: data.state.score2, winner: data.state.winner };
        });
      }
      if (data.type === "game_over") {
        const winner = (data.winner === 1 || data.winner === 2) ? data.winner : null;
        setUI(prev => ({ ...prev, winner }));
        updatePhase("gameover");
        optsRef.current.onGameOver?.(winner);
      }
      if (data.type === "player_disconnect") {
        updatePhase("disconnected");
      }
      if (data.type === "error") {
        updatePhase("disconnected");
      }
    };

    return () => ws.close();
  }, [wsKey, updatePhase]);

  const safeSend = useCallback((payload: object) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }, []);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
      e.preventDefault();
      safeSend({ action: "keydown", key: e.key });
    };
    const onUp = (e: KeyboardEvent) => {
      if (!["ArrowUp", "ArrowDown"].includes(e.key)) return;
      safeSend({ action: "keyup", key: e.key });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, [safeSend]);

  const findMatch = useCallback(() => {
    safeSend({ action: "find_match" });
    updatePhase("waiting");
  }, [safeSend, updatePhase]);

  const requestRematch = useCallback(() => {
    safeSend({ action: "rematch" });
  }, [safeSend]);

  const reconnect = useCallback(() => {
    updatePhase("idle");
    setWsKey(k => k + 1);
  }, [updatePhase]);

  return { ui, findMatch, requestRematch, reconnect, MAX_SCORE };
}
