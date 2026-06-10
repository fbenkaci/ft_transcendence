"use client"
import Link from "next/link"
import { useEffect, useState } from "react"
import { House, UserPlus, UserX, Check, X, Loader2 } from 'lucide-react'
import { useRouter } from "next/navigation"

interface Friend {
  username: string
  status: string
  avatar_url: string | null
}

interface FriendRequest {
  username: string
  avatar_url: string | null
}

export default function FriendsPage() {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>([])
  const [requests, setRequests] = useState<FriendRequest[]>([])
  const [searchUsername, setSearchUsername] = useState("")
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const fetchData = async () => {
    const token = localStorage.getItem("access_token")
    if (!token) {
      router.push("/login")
      return
    }
    try {
      const [resFriends, resRequests] = await Promise.all([
        fetch("/api/friends/", { headers: { "Authorization": `Bearer ${token}` } }),
        fetch("/api/friends/requests/", { headers: { "Authorization": `Bearer ${token}` } })
      ])
      
      if (resFriends.ok && resRequests.ok) {
        const dataFriends = await resFriends.json()
        const dataRequests = await resRequests.json()
        setFriends(dataFriends.friends || [])
        setRequests(dataRequests.requests || [])
      }
    } catch (err) {
      setError("Erreur de chargement des données.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [router])

  const apiCall = async (url: string, body?: any) => {
    setActionLoading(true)
    setError("")
    setSuccess("")
    const token = localStorage.getItem("access_token")
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: body ? JSON.stringify(body) : null
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(data.message)
        setSearchUsername("")
        fetchData()
      } else {
        setError(data.error || "Erreur.")
      }
    } catch (err) {
      setError("Erreur réseau.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleSendRequest = () => {
    if (searchUsername.trim()) {
      apiCall(`/api/friends/request/send/${searchUsername}/`)
    }
  }

  const handleRespondRequest = (username: string, action: 'accept' | 'reject') => {
    apiCall(`/api/friends/request/respond/${username}/`, { action })
  }

  const handleRemoveFriend = (username: string) => {
    if(confirm(`Es-tu sûr de vouloir retirer ${username} de tes amis ?`)) {
        apiCall(`/api/friends/remove/${username}/`)
    }
  }

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="account-card max-w-lg">
        <h2 className="account-field-label text-xl mb-5 text-center">
          Réseau Social
        </h2>

        <div className="account-field mb-5">
          <label className="account-field-label">Ajouter un ami</label>
          <div className="password-input-wrap flex gap-2">
            <input 
              className="tr-input" 
              type="text" 
              placeholder="Username..." 
              value={searchUsername} 
              onChange={e => setSearchUsername(e.target.value)} 
              disabled={actionLoading}
            />
            <button 
              className="btn-start px-4 h-[45px] flex items-center justify-center"
              onClick={handleSendRequest} 
              disabled={actionLoading}
            >
              {actionLoading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
            </button>
          </div>
          {error && <p className="text-destructive text-xs mt-1">{error}</p>}
          {success && <p className="text-green-500 text-xs mt-1">{success}</p>}
        </div>

        {requests.length > 0 && (
          <div className="account-field mb-5">
            <label className="account-field-label text-blue-400">Demandes reçues ({requests.length})</label>
            <div className="flex flex-col gap-2 mt-2">
              {requests.map(req => (
                <div key={req.username} className="flex items-center justify-between p-3 bg-blue-500/10 rounded-lg border border-blue-500/30">
                  <div className="flex items-center gap-3">
                    <img src={req.avatar_url || "/test.jpg"} alt={req.username} className="w-9 h-9 rounded-full object-cover" />
                    <span className="font-bold text-sm">{req.username}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleRespondRequest(req.username, 'accept')} className="bg-green-500 text-white rounded-md px-3 py-1.5 hover:bg-green-600 transition">
                      <Check size={16} />
                    </button>
                    <button onClick={() => handleRespondRequest(req.username, 'reject')} className="bg-destructive text-white rounded-md px-3 py-1.5 hover:opacity-80 transition">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION : LISTE D'AMIS */}
        <div className="account-field">
          <label className="account-field-label">Mes amis ({friends.length})</label>
          {loading ? (
             <div className="flex justify-center p-5"><Loader2 className="animate-spin" /></div>
          ) : friends.length === 0 ? (
            <p className="opacity-60 text-sm text-center py-3">Aucun ami pour le moment.</p>
          ) : (
            <div className="flex flex-col gap-3 mt-3 max-h-[200px] overflow-y-auto">
              {friends.map(friend => (
                <div key={friend.username} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={friend.avatar_url || "/test.jpg"} alt={friend.username} className="w-9 h-9 rounded-full object-cover" />
                    <div>
                      <div className="font-bold text-sm">{friend.username}</div>
                      <div className="text-xs opacity-70 flex items-center gap-1.5 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${friend.status === 'online' ? 'bg-green-500' : friend.status === 'ingame' ? 'bg-blue-500' : 'bg-gray-500'}`} />
                        {friend.status === "online" ? "En ligne" : friend.status === "ingame" ? "En jeu" : "Hors ligne"}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveFriend(friend.username)} className="text-destructive hover:opacity-80 p-1">
                    <UserX size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Link href="/" className="home-btn"><House className="w-6 h-6" /></Link>
    </main>
  )
}
