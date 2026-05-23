"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { User, House, Pencil, Check, X, Eye, EyeOff } from 'lucide-react'
import { useRouter } from "next/navigation"

interface ProfileData {
  username: string
  email: string
  password?: string
  old_password?: string
  avatar: string
}

export default function Page() {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPasswordOld, setShowPasswordOld] = useState(false)
  const [showPasswordNew, setShowPasswordNew] = useState(false)
  const [error, setError] = useState("")
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  
  const [profile, setProfile] = useState<ProfileData>({
    username: "Chargement...",
    email: "Chargement...",
    avatar: "/test.jpg",
  })
  
  const [draft, setDraft] = useState<ProfileData>(profile)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const toggleButtons = document.querySelectorAll(".password-toggle");
    const handleActive = (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      btn.classList.add("active");
      setTimeout(() => btn.classList.remove("active"), 150);
    };
    toggleButtons.forEach(btn => btn.addEventListener("mousedown", handleActive));
    return () => toggleButtons.forEach(btn => btn.removeEventListener("mousedown", handleActive));
  }, [isEditing]);

  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    fetch("http://127.0.0.1:8000/api/me/", {
      headers: { "Authorization": `Bearer ${token}` }
    })
    .then(res => res.ok ? res.json() : Promise.reject())
    .then(data => {
      const updated = {
        username: data.username,
        email: data.email,
        avatar: data.avatar_url ? `${data.avatar_url}?t=${Date.now()}` : "/test.jpg",
      }
      setProfile(updated)
      setDraft(updated)
    })
    .catch(() => {
      localStorage.removeItem("access_token");
      router.push("/login");
    });
  }, [router]);

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

  const handleAvatarClick = () => { if (isEditing) fileInputRef.current?.click() }

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarFile(file)
    const url = URL.createObjectURL(file)
    setDraft(d => ({ ...d, avatar: url }))
  }

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
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
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
          
          {error && <p style={{color: 'var(--color-destructive)', fontSize: '12px'}}>{error}</p>}
        </div>

        <div className="account-actions">
          {!isEditing ? (
            <button className="btn-start" onClick={handleEdit} style={{ width: "100%" }}>Edit Profile</button>
          ) : (
            <>
              <button className="btn-ghost" onClick={handleCancel} disabled={saving} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-start" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>{saving ? "Saving…" : "Save"}</button>
            </>
          )}
        </div>
      </div>

      <Link href="/" className="home-btn"><House className="w-6 h-6" /></Link>
      <div className="net" aria-hidden="true" />
    </main>
  )
}
