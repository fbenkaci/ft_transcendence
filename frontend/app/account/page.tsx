"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { House, Pencil, Eye, EyeOff, Users, ShieldCheck, ShieldAlert } from 'lucide-react'
import { useRouter } from "next/navigation"

interface ProfileData {
  username: string
  email: string
  password?: string
  old_password?: string
  avatar: string
  wins?: number
  losses?: number
  is_2fa_enabled?: boolean
}

export default function Page() {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPasswordOld, setShowPasswordOld] = useState(false)
  const [showPasswordNew, setShowPasswordNew] = useState(false)
  const [error, setError] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  
  const [twoFactorSecret, setTwoFactorSecret] = useState("")
  const [twoFactorCode, setTwoFactorCode] = useState("")
  const [show2FASetup, setShow2FASetup] = useState(false)

  const [profile, setProfile] = useState<ProfileData>({
    username: "Chargement...",
    email: "Chargement...",
    avatar: "/test.jpg",
    wins: 0,
    losses: 0,
    is_2fa_enabled: false
  })
  
  const [draft, setDraft] = useState<ProfileData>(profile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadProfile = async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    try {
      const res = await fetch("http://127.0.0.1:8000/api/me/", {
        headers: { "Authorization": `Bearer ${token}` }
      })
      if (res.ok) {
        const data = await res.json()
        const updated = {
          username: data.username,
          email: data.email,
          avatar: data.avatar_url || "/test.jpg",
          wins: data.wins || 0,
          losses: data.losses || 0,
          is_2fa_enabled: data.is_2fa_enabled
        }
        setProfile(updated)
        setDraft(updated)
      } else {
        throw new Error()
      }
    } catch {
      localStorage.removeItem("access_token");
      router.push("/login");
    }
  }

  useEffect(() => { loadProfile() }, [router])

  const handleEdit = () => {
    setDraft({ ...profile, old_password: "", password: "" })
    setIsEditing(true)
    setError("")
  }

  const handleCancel = () => {
    setDraft(profile)
    setIsEditing(false)
    setShowPasswordOld(false)
    setShowPasswordNew(false)
    setError("")
    setAvatarFile(null)
  }

  const handleSave = async () => {
    setSaving(true)
    setError("")
    const token = localStorage.getItem("access_token");
    const formData = new FormData();
    
    if (avatarFile) formData.append('avatar', avatarFile);
    if (draft.old_password) formData.append('old_password', draft.old_password);
    if (draft.password) formData.append('new_password', draft.password);

    const res = await fetch("http://127.0.0.1:8000/api/update_profile/", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` },
      body: formData
    })

    if (res.ok) {
      const data = await res.json();
      setProfile({ 
        ...draft, 
        avatar: data.avatar_url ? `${data.avatar_url}?t=${Date.now()}` : draft.avatar 
      })
      setIsEditing(false)
      setAvatarFile(null)
    } else {
      setError("Erreur lors de la mise à jour.")
    }
    setSaving(false)
  }

  const handleSetup2FA = async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("http://127.0.0.1:8000/api/2fa/enable/", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    })
    if (res.ok) {
      const data = await res.json()
      setTwoFactorSecret(data.secret)
      setShow2FASetup(true)
    }
  }

  const handleConfirm2FA = async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("http://127.0.0.1:8000/api/2fa/activate/", {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ code: twoFactorCode })
    })
    if (res.ok) {
      setShow2FASetup(false)
      setTwoFactorCode("")
      loadProfile()
    } else {
      setError("Code de validation incorrect.")
    }
  }

  const handleDisable2FA = async () => {
    const token = localStorage.getItem("access_token");
    const res = await fetch("http://127.0.0.1:8000/api/2fa/disable/", {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}` }
    })
    if (res.ok) {
      loadProfile()
    }
  }

  const handleAvatarClick = () => { if (isEditing) fileInputRef.current?.click() }

  return (
    <main className="tr-wrap">
      <div className="balls-layer" aria-hidden="true">
        {[...Array(5)].map((_, i) => (
          <div key={i} className={`ball ball-${i + 1}`} />
        ))}
      </div>

      <div className="account-card">
        <div className={`account-avatar-wrap ${isEditing ? "editable" : ""}`} onClick={handleAvatarClick}>
          <img src={draft.avatar} alt="Profile" className="account-avatar" />
          {isEditing && (
            <div className="account-avatar-overlay">
              <Pencil size={22} color="#CDE6F5" />
            </div>
          )}
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => {
            const file = e.target.files?.[0]
            if (file) {
              setAvatarFile(file)
              setDraft(d => ({ ...d, avatar: URL.createObjectURL(file) }))
            }
          }} />
        </div>

        <div className="account-fields">
          <div className="account-field">
            <label className="account-field-label">Username</label>
            <div className="account-field-value">{profile.username}</div>
          </div>
          <div className="account-field">
            <label className="account-field-label">Email</label>
            <div className="account-field-value">{profile.email}</div>
          </div>

          <div className="flex gap-5 mt-2">
            <div className="account-field flex-1">
              <label className="account-field-label">Victoires</label>
              <div className="account-field-value text-green-500 font-bold">{profile.wins}</div>
            </div>
            <div className="account-field flex-1">
              <label className="account-field-label">Défaites</label>
              <div className="account-field-value text-destructive font-bold">{profile.losses}</div>
            </div>
          </div>

          {/* VOLET DOUBLE FACTEUR (2FA) */}
          <div className="account-field border border-white/10 rounded-xl p-4 mt-2 bg-white/5">
            <label className="account-field-label flex items-center gap-2 mb-2">
              {profile.is_2fa_enabled ? <ShieldCheck className="text-green-500" size={16} /> : <ShieldAlert className="text-destructive" size={16} />}
              Double Facteur (2FA)
            </label>
            
            {!profile.is_2fa_enabled ? (
              !show2FASetup ? (
                <button type="button" className="btn-start text-xs py-2 w-full" onClick={handleSetup2FA}>Activer la 2FA</button>
              ) : (
                <div className="flex flex-col gap-2 mt-2">
                  <p className="text-xs text-white/60">Ajoute cette clé secrète dans ton application d'authentification :</p>
                  <div className="bg-black/40 text-center p-2 rounded text-sm tracking-widest font-mono select-all text-blue-300">{twoFactorSecret}</div>
                  <input className="tr-input mt-1" type="text" placeholder="Entrez le code à 6 chiffres..." value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value)} />
                  <button type="button" className="btn-start text-xs py-2 w-full mt-1" onClick={handleConfirm2FA}>Valider le code</button>
                </div>
              )
            ) : (
              <button type="button" className="btn-ghost text-xs py-2 w-full text-destructive hover:bg-destructive/10" onClick={handleDisable2FA}>Désactiver la 2FA</button>
            )}
          </div>

          {isEditing && (
            <>
              <div className="account-field">
                <label className="account-field-label">Ancien mot de passe</label>
                <div className="password-input-wrap">
                  <input className="tr-input password-input" type={showPasswordOld ? "text" : "password"} value={draft.old_password || ""} onChange={e => setDraft(d => ({...d, old_password: e.target.value}))} />
                  <button type="button" className="password-toggle" onClick={() => setShowPasswordOld(v => !v)}>{showPasswordOld ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div className="account-field">
                <label className="account-field-label">Nouveau mot de passe</label>
                <div className="password-input-wrap">
                  <input className="tr-input password-input" type={showPasswordNew ? "text" : "password"} value={draft.password || ""} onChange={e => setDraft(d => ({...d, password: e.target.value}))} />
                  <button type="button" className="password-toggle" onClick={() => setShowPasswordNew(v => !v)}>{showPasswordNew ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
            </>
          )}
          
          {error && <p className="text-destructive text-xs mt-2">{error}</p>}
        </div>

        <div className="account-actions mt-4">
          {!isEditing ? (
            <div className="flex flex-col gap-2 w-full">
              <button className="btn-start" onClick={handleEdit}>Edit Profile</button>
              <Link href="/friends" className="btn-ghost flex items-center justify-center gap-2">
                <Users size={16} /> Amis
              </Link>
            </div>
          ) : (
            <>
              <button className="btn-ghost flex-1" onClick={handleCancel} disabled={saving}>Cancel</button>
              <button className="btn-start flex-[2]" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </>
          )}
        </div>
      </div>

      <Link href="/" className="home-btn"><House className="w-6 h-6" /></Link>
      <div className="net" aria-hidden="true" />
    </main>
  )
}
