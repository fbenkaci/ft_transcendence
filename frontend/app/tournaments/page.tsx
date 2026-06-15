"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { House, User, Trophy, Plus } from "lucide-react";

interface TournamentLite {
  id: number;
  name: string;
  creator: string;
  status: string;
  max_players: number;
  participant_count: number;
  winner: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Inscriptions",
  ongoing: "En cours",
  completed: "Terminé",
};

export default function TournamentsPage() {
  const router = useRouter();
  const [list, setList] = useState<TournamentLite[]>([]);
  const [name, setName] = useState("");
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") : null);

  const load = useCallback(async () => {
    const t = token();
    if (!t) { router.push("/login"); return; }
    try {
      const res = await fetch("/api/tournaments/", {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setList(Array.isArray(data) ? data : []);
    } catch {
      setError("Erreur réseau.");
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/tournaments/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ name, max_players: maxPlayers }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push(`/tournaments/${data.id}`);
      } else {
        setError(data.error || "Création impossible.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
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

      <Link href="/start" className="home-btn"><House className="w-6 h-6" /></Link>
      <Link href="/account" className="account-btn"><User className="w-6 h-6" /></Link>

      <div className="tr-panel">
        <div className="title-row" style={{ marginBottom: 4 }}>
          <Trophy className="w-7 h-7" style={{ color: "#CDE6F5", opacity: 0.9 }} />
          <h1 className="title" style={{ fontSize: "1.6rem" }}>Tournaments</h1>
        </div>

        <form onSubmit={createTournament} className="tr-create">
          <input
            className="tr-input"
            placeholder="Nom du tournoi"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select
            className="tr-input tr-select"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {[2, 4, 8, 16].map((n) => (
              <option key={n} value={n}>{n} joueurs</option>
            ))}
          </select>
          <button type="submit" disabled={loading} className="btn-start tr-create-btn">
            <Plus className="w-4 h-4" /> {loading ? "…" : "Créer"}
          </button>
        </form>

        {error && <p className="text-destructive text-xs text-center">{error}</p>}

        <div className="tr-list">
          {list.length === 0 && (
            <p className="tagline" style={{ textAlign: "center" }}>Aucun tournoi pour l'instant</p>
          )}
          {list.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`} className="tr-card">
              <div className="tr-card-main">
                <span className="tr-card-name">{t.name}</span>
                <span className="tr-card-sub">par {t.creator}</span>
              </div>
              <div className="tr-card-right">
                <span className={`tr-badge tr-badge-${t.status}`}>
                  {STATUS_LABEL[t.status] ?? t.status}
                </span>
                <span className="tr-card-count">
                  {t.winner ? `🏆 ${t.winner}` : `${t.participant_count}/${t.max_players}`}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
