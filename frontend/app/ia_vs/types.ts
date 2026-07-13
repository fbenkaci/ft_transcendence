import {
  CANVAS_W,
  CANVAS_H,
  PADDLE_H,
  INITIAL_BALL_SPEED,
} from "./constants";

export type Phase = "idle" | "playing" | "scored" | "gameover";

export interface GameState {
  p1y: number;
  p2y: number;
  bx: number;
  by: number;
  vx: number;
  vy: number;
  score1: number;
  score2: number;
  running: boolean;
  phase: Phase;
  winner: 1 | 2 | null;
}

export function makeInitialState(): GameState {
  return {
    p1y: CANVAS_H / 2 - PADDLE_H / 2,
    p2y: CANVAS_H / 2 - PADDLE_H / 2,
    bx: CANVAS_W / 2,
    by: CANVAS_H / 2,
    vx: 0,
    vy: 0,
    score1: 0,
    score2: 0,
    running: false,
    phase: "idle",
    winner: null,
  };
}

export function launchBall(toRight: boolean) {
  const angle = (Math.random() * Math.PI) / 3 - Math.PI / 6;
  return {
    vx: INITIAL_BALL_SPEED * (toRight ? 1 : -1) * Math.cos(angle),
    vy: INITIAL_BALL_SPEED * Math.sin(angle),
  };
}