"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, LockKeyhole } from "lucide-react";
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
    const {data,error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
    if(authError){setBusy(false);setError(authError.message==="Invalid login credentials"?"Correo o contraseña incorrectos.":authError.message);return;}
    const {data:profile,error:profileError}=await supabase.from("profiles").select("role,active").eq("id",data.user.id).maybeSingle();
    if(profileError || !profile || !profile.active){await supabase.auth.signOut();setBusy(false);setError("El usuario existe, pero no tiene un perfil activo en Darkphone Tech. Debes crear su registro en public.profiles desde el SQL Editor de Supabase.");return;}
    setBusy(false);router.replace("/");router.refresh();
  }
  return <main className="login-page"><div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/><section className="login-card">
    <div className="login-brand-centered"><div className="login-monogram" aria-hidden="true">D<span>.</span></div><div className="login-wordmark">DARKPHONE <span>TECH</span></div><p>GESTIÓN INTEGRAL</p></div>
    <div className="login-divider"><span/></div>
    <div className="login-heading"><span className="login-icon"><LockKeyhole size={19}/></span><h1>Bienvenido de nuevo</h1><p>Inicia sesión para continuar con tu negocio.</p></div>
    <form onSubmit={submit} className="login-form"><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@empresa.com"/></div><div className="field"><label htmlFor="password">Contraseña</label><input id="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/></div>{error&&<div className="notice login-error" role="alert">{error}</div>}<button className="button login-submit" type="submit" disabled={busy}>{busy?"Validando acceso…":<><LogIn size={16}/> Entrar al sistema</>}</button></form>
    <div className="login-secure"><ShieldCheck size={14}/><span>Acceso seguro para usuarios autorizados</span></div>
  </section><footer className="login-footer">DARKPHONE TECH <span>·</span> TU NEGOCIO, BAJO CONTROL</footer></main>;
}
