"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { User } from 'lucide-react';
import { House } from 'lucide-react';
import { AiDifficulty } from "./useGameLoops";

const PongCanvas = dynamic(() => import("./PongCanvas"), { ssr: false });

export default function Page() {
  const [difficulte, setDifficulte] = useState<AiDifficulty>(AiDifficulty.EASY);

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="difficulty-selector">
        <button
          type="button"
          onClick={() => setDifficulte(AiDifficulty.EASY)}
          className={`difficulty-button${difficulte === AiDifficulty.EASY ? " active" : ""}`}
        >
          Easy
        </button>
        <button
          type="button"
          onClick={() => setDifficulte(AiDifficulty.MEDIUM)}
          className={`difficulty-button${difficulte === AiDifficulty.MEDIUM ? " active" : ""}`}
        >
          Medium
        </button>
        <button
          type="button"
          onClick={() => setDifficulte(AiDifficulty.HARD)}
          className={`difficulty-button${difficulte === AiDifficulty.HARD ? " active" : ""}`}
        >
          Hard
        </button>
      </div>

      <PongCanvas difficulte={difficulte} />

      <Link href="/" className="home-btn">
        <House className="w-6 h-6" />
      </Link>

      <Link href="/account" className="account-btn">
        <User className="w-6 h-6" />
      </Link>
    </main>
  );
}
