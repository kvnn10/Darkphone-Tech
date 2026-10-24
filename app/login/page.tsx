"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, LockKeyhole, LogIn } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage(){
  const router=useRouter();
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    if(!supabase){setError("Falta configurar NEXT_PUBLIC_SUPABASE_URL y la clave pública en Vercel. Después debes volver a desplegar.");return;}
    setBusy(true);
    const {error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    setBusy(false);
    if(authError){setError(authError.message==="Invalid login credentials"?"Correo o contraseña incorrectos.":authError.message);return;}
    router.replace("/");
    router.refresh();
  }
  return <main className="login-page"><section className="login-card"><div className="login-brand"><div className="brand-mark"><Activity size={21}/></div><div><strong>Darkphone Tech</strong><small>Gestión del negocio</small></div></div><div className="login-heading"><span className="login-icon"><LockKeyhole size={20}/></span><h1>Iniciar sesión</h1><p>Ingresa con el usuario autorizado para acceder al sistema.</p></div><form onSubmit={submit} className="login-form"><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/></div><div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></div>{error&&<div className="notice login-error" role="alert">{error}</div>}<button className="button login-submit" type="submit" disabled={busy}>{busy?"Validando acceso…":<><LogIn size={16}/> Entrar al sistema</>}</button></form><p className="login-help">El usuario debe crearse previamente en Supabase Authentication. No hay registro público de usuarios.</p></section></main>;
}
