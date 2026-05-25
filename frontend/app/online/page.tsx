"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { House, User } from "lucide-react";

const OnlinePongCanvas = dynamic(() => import("./OnlinePongCanvas"), { ssr: false });

export default function Page() {
  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="net" aria-hidden="true" />

      <Link href="/" className="home-btn">
        <House className="w-6 h-6" />
      </Link>

      <Link href="/account" className="account-btn">
        <User className="w-6 h-6" />
      </Link>

      <OnlinePongCanvas />
    </main>
  );
}
