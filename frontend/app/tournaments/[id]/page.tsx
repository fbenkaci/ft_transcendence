"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { House, User, Trophy, Swords, Link2 } from "lucide-react";

const TournamentMatchCanvas = dynamic(() => import("./TournamentMatchCanvas"), { ssr: false });

interface Participant { username: string; seed: number | null; is_eliminated: boolean; }
interface Match {
  id: number; round: number; slot: number;
  player1: string | null; player2: string | null;
  winner: string | null; status: string;
}
interface Tournament {
  id: number; name: string; creator: string; status: string;
  max_players: number; winner: string | null;
  participant_count: number; participants: Participant[]; matches: Match[];
}

// data de la blockcahin
interface ChainMatch {
  matchId: number; round: number;
  player1: string; player2: string;
  score1: number; score2: number;
  winner: string; playedAt: number;
}
interface ChainData {
  name: string; creator: string; maxPlayers: number;
  createdAt: number; contractAddress: string; matches: ChainMatch[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Inscriptions ouvertes",
  ongoing: "En cours",
  completed: "Terminé",
};

export default function TournamentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const tid = params.id as string;
  const isChain = searchParams.get("mode") === "blockchain";

  const [t, setT] = useState<Tournament | null>(null);
  const [me, setMe] = useState<string>("");
  const [error, setError] = useState("");
  const [playingMatch, setPlayingMatch] = useState<number | null>(null);

  // état de la vue blockchain
  const [chain, setChain] = useState<ChainData | null>(null);
  const [chainErr, setChainErr] = useState("");
  const [chainLoading, setChainLoading] = useState(false);

  const token = () => (typeof window !== "undefined" ? localStorage.getItem("access_token") : null);

  const load = useCallback(async () => {
    const tk = token();
    if (!tk) { router.push("/login"); return; }
    try {
      const [tRes, meRes] = await Promise.all([
        fetch(`/api/tournaments/${tid}/`, { headers: { Authorization: `Bearer ${tk}` } }),
        fetch(`/api/me/`, { headers: { Authorization: `Bearer ${tk}` } }),
      ]);
      if (tRes.status === 401) { router.push("/login"); return; }
      setT(await tRes.json());
      const meData = await meRes.json();
      setMe(meData.username || "");
    } catch {
      setError("Erreur réseau.");
    }
  }, [tid, router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (playingMatch !== null || isChain) return;
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, [load, playingMatch, isChain]);

  // fetch de la data blockchain quand on entre en mode ?mode=blockchain
  useEffect(() => {
    if (!isChain) { setChain(null); setChainErr(""); return; }
    const run = async () => {
      setChainLoading(true); setChainErr("");
      try {
        const res = await fetch(`/api/tournaments/${tid}/blockchain/`, {
          headers: { Authorization: `Bearer ${token()}` },
        });
        const data = await res.json();
        if (!res.ok) { setChainErr(data.error || "Lecture blockchain impossible."); setChain(null); }
        else setChain(data);
      } catch {
        setChainErr("Erreur réseau (blockchain).");
      } finally {
        setChainLoading(false);
      }
    };
    run();
  }, [isChain, tid]);

  const toggleChain = () => {
    router.push(isChain ? `/tournaments/${tid}` : `/tournaments/${tid}?mode=blockchain`);
  };

  const act = async (path: string) => {
    setError("");
    try {
      const res = await fetch(`/api/tournaments/${tid}/${path}/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Action impossible.");
      await load();
    } catch {
      setError("Erreur réseau.");
    }
  };

  const playMyMatch = async () => {
    try {
      const res = await fetch(`/api/tournaments/${tid}/my-match/`, {
        headers: { Authorization: `Bearer ${token()}` },
      });
      const data = await res.json();
      if (data.match_id) setPlayingMatch(data.match_id);
      else setError("Aucun match à jouer pour l'instant (attends ton tour).");
    } catch {
      setError("Erreur réseau.");
    }
  };

  if (!t) {
    return (
      <main className="tr-wrap">
        <div className="net" aria-hidden="true" />
        <p className="tagline">Chargement…</p>
      </main>
    );
  }

  if (playingMatch !== null) {
    return (
      <main className="tr-wrap">
        <div className="balls-layer" aria-hidden="true">
          {[...Array(5)].map((_, i) => (<div key={i} className={`ball ball-${i + 1}`} />))}
        </div>
        <div className="net" aria-hidden="true" />
        <TournamentMatchCanvas
          matchId={playingMatch}
          onLeave={() => { setPlayingMatch(null); load(); }}
        />
      </main>
    );
  }

  const isParticipant = t.participants.some((p) => p.username === me);
  const isCreator = t.creator === me;
  const rounds = [...new Set(t.matches.map((m) => m.round))].sort((a, b) => a - b);
  const myPending = t.matches.find(
    (m) => m.status === "pending" && (m.player1 === me || m.player2 === me),
  );

  // rounds côté blockchain
  const chainRounds = chain
    ? [...new Set(chain.matches.map((m) => m.round))].sort((a, b) => a - b)
    : [];

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (<div key={i} className={`ball ball-${i + 1}`} />))}
      </div>
      <div className="net" aria-hidden="true" />

      <Link href="/tournaments" className="home-btn"><House className="w-6 h-6" /></Link>
      <Link href="/account" className="account-btn"><User className="w-6 h-6" /></Link>

      <div className="tr-panel">
        <div className="title-row" style={{ marginBottom: 0 }}>
          <Trophy className="w-6 h-6" style={{ color: "#CDE6F5", opacity: 0.9 }} />
          <h1 className="title" style={{ fontSize: "1.5rem" }}>{t.name}</h1>
        </div>
        <p className="tagline" style={{ textAlign: "center" }}>
          {STATUS_LABEL[t.status] ?? t.status}
          {t.winner && ` · 🏆 ${t.winner}`}
        </p>

        {/* btn blockchain vue */}
        <div className="tr-actions">
          <button
            className={isChain ? "btn-start" : "btn-ghost"}
            onClick={toggleChain}
          >
            <Link2 className="w-4 h-4" />
            {isChain ? "Vue DB" : "Voir sur la blockchain"}
          </button>
        </div>

        {/* blockchain vue */}
        {isChain ? (
          <div className="tr-chain">
            {chainLoading && <p className="tagline" style={{ textAlign: "center" }}>Lecture de la blockchain…</p>}
            {chainErr && <p className="text-destructive text-xs text-center">{chainErr}</p>}
            {chain && (
              <>
                <p className="tagline" style={{ textAlign: "center", color: "#7CFFB2" }}>
                  ✓ Données vérifiées on-chain
                </p>
                <p style={{ fontSize: "0.7rem", textAlign: "center", opacity: 0.7, wordBreak: "break-all" }}>
                  Contrat : {chain.contractAddress}
                </p>
                <p className="tagline" style={{ textAlign: "center" }}>
                  {chain.name} · créé par {chain.creator} · {chain.maxPlayers} joueurs max
                </p>

                {chainRounds.length === 0 && (
                  <p className="tagline" style={{ textAlign: "center" }}>Aucun match enregistré on-chain.</p>
                )}

                {chainRounds.map((r) => (
                  <div key={r} className="tr-brackets">
                    <span className="tr-round-title">Round {r}</span>
                    {chain.matches.filter((m) => m.round === r).map((m, i) => (
                      <div key={i} className="tr-match done">
                        <span className={`tr-seat ${m.winner === m.player1 ? "win" : ""}`}>{m.player1 || "—"}</span>
                        <span className={`tr-seat ${m.winner === m.player2 ? "win" : ""}`}>{m.player2 || "(bye)"}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (

          <>
            <div className="tr-actions">
              {t.status === "pending" && !isParticipant && (
                <button className="btn-start" onClick={() => act("join")}>Rejoindre</button>
              )}
              {t.status === "pending" && isParticipant && !isCreator && (
                <button className="btn-ghost" onClick={() => act("leave")}>Quitter</button>
              )}
              {t.status === "pending" && isCreator && (
                <button className="btn-start" onClick={() => act("start")}>Lancer le tournoi</button>
              )}
              {t.status === "ongoing" && myPending && (
                <button className="btn-start" onClick={playMyMatch}>
                  <Swords className="w-4 h-4" /> Jouer mon match (R{myPending.round})
                </button>
              )}
            </div>

            {error && <p className="text-destructive text-xs text-center">{error}</p>}

            {t.status === "pending" && (
              <div className="tr-players">
                {t.participants.map((p) => (
                  <span key={p.username} className="tr-chip">
                    {p.username}{p.username === t.creator ? " 👑" : ""}
                  </span>
                ))}
              </div>
            )}

            {rounds.length > 0 && (
              <div className="tr-bracket">
                {rounds.map((r) => (
                  <div key={r} className="tr-round">
                    <span className="tr-round-title">Round {r}</span>
                    {t.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot).map((m) => (
                      <div key={m.id} className={`tr-match ${m.status === "finished" ? "done" : ""}`}>
                        <span className={`tr-seat ${m.winner && m.winner === m.player1 ? "win" : ""}`}>
                          {m.player1 ?? "—"}
                        </span>
                        <span className="tr-vs">vs</span>
                        <span className={`tr-seat ${m.winner && m.winner === m.player2 ? "win" : ""}`}>
                          {m.player2 ?? "(bye)"}
                        </span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
