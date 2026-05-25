"use client"
import Link from "next/link"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { House, Eye, EyeOff, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  
  const [requires2FA, setRequires2FA] = useState(false)
  const [twoFactorCode, setTwoFactorCode] = useState("")
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json()

      if (res.ok) {
        if (data.requires_2fa) {
          setRequires2FA(true)
        } else {
          localStorage.setItem("access_token", data.access)
          localStorage.setItem("refresh_token", data.refresh)
          router.push("/start")
        }
      } else {
        setError(data.detail || "Identifiants ou configuration incorrecte.")
      }
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://127.0.0.1:8000/api/login/verify-2fa/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, code: twoFactorCode })
      })

      const data = await res.json()

      if (res.ok) {
        localStorage.setItem("access_token", data.access)
        localStorage.setItem("refresh_token", data.refresh)
        router.push("/start")
      } else {
        setError(data.error || "Code invalide.")
      }
    } catch {
      setError("Erreur réseau.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="account-card max-w-sm">
        {!requires2FA ? (
          <form onSubmit={handleLogin} className="account-fields w-full">
            <h2 className="account-field-label text-xl mb-5 text-center">Connexion</h2>
            
            <div className="account-field">
              <label className="account-field-label">Username</label>
              <input className="tr-input" type="text" required value={username} onChange={e => setUsername(e.target.value)} />
            </div>

            <div className="account-field">
              <label className="account-field-label">Password</label>
              <div className="password-input-wrap">
                <input className="tr-input password-input" type={showPassword ? "text" : "password"} required value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && <p className="text-destructive text-xs mt-1 text-center">{error}</p>}

            <button type="submit" disabled={loading} className="btn-start w-full mt-4">
              {loading ? "Connexion..." : "Sign In"}
            </button>
            <p className="text-center text-xs opacity-60 mt-2">
              Pas de compte ? <Link href="/signup" className="text-blue-400 hover:underline">Créer un compte</Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerify2FA} className="account-fields w-full">
            <h2 className="account-field-label text-xl mb-5 text-center flex items-center justify-center gap-2 text-blue-400">
              <ShieldCheck size={24} /> Vérification 2FA
            </h2>
            <p className="text-xs text-white/60 text-center mb-4">Saisissez le code temporaire généré par votre application d'authentification.</p>

            <div className="account-field">
              <label className="account-field-label">Code Authenticateur</label>
              <input className="tr-input text-center tracking-widest font-mono text-lg" type="text" maxLength={6} required placeholder="000000" value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} />
            </div>

            {error && <p className="text-destructive text-xs mt-1 text-center">{error}</p>}

            <button type="submit" disabled={loading} className="btn-start w-full mt-4">
              {loading ? "Vérification..." : "Vérifier"}
            </button>
          </form>
        )}
      </div>

      <Link href="/" className="home-btn"><House className="w-6 h-6" /></Link>
      <div className="net" aria-hidden="true" />
    </main>
  )
}
