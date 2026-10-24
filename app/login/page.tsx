"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, LockKeyhole, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/lib/supabase";

export default function LoginPage(){
 const router=useRouter();
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 const [showPassword,setShowPassword]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setError("");
  if(!supabase){setError("Falta configurar NEXT_PUBLIC_SUPABASE_URL y la clave pública en Vercel. Después debes volver a desplegar.");return;}
  setBusy(true);
  const {data,error:authError}=await supabase.auth.signInWithPassword({email:email.trim(),password});
  if(authError){setBusy(false);setError(authError.message==="Invalid login credentials"?"Correo o contraseña incorrectos.":authError.message);return;}
  const {data:profile,error:profileError}=await supabase.from("profiles").select("role,active").eq("id",data.user.id).maybeSingle();
  if(profileError||!profile||!profile.active){await supabase.auth.signOut();setBusy(false);setError("El usuario existe, pero no tiene un perfil activo en Darkphone Tech. Debes crear su registro en public.profiles desde el SQL Editor de Supabase.");return;}
  setBusy(false);router.replace("/");router.refresh();
 }
 return <main className="login-page"><div className="login-glow login-glow-one"/><div className="login-glow login-glow-two"/><section className="login-card">
  <div className="login-brand-centered"><Image className="login-logo-image" src="/darkphone-mark.svg" alt="Logo de DarkPhone" width={88} height={88} priority/><div className="login-wordmark">DarkPhone</div><p>GESTIÓN INTELIGENTE DE TU NEGOCIO</p></div>
  <div className="login-divider"><span/></div>
  <div className="login-heading"><span className="login-icon"><LockKeyhole size={19}/></span><h1>Qué bueno verte.</h1><p>Ingresa a tu espacio de trabajo para continuar.</p></div>
  <form onSubmit={submit} className="login-form"><div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="nombre@empresa.com"/></div>
  <div className="field"><div className="login-password-label"><label htmlFor="password">Contraseña</label><span>Acceso privado</span></div><div className="login-password-wrap"><input id="password" type={showPassword?"text":"password"} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Ingresa tu contraseña"/><button className="login-password-toggle" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Ocultar contraseña":"Mostrar contraseña"}>{showPassword?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></div>
  {error&&<div className="notice login-error" role="alert">{error}</div>}<button className="button login-submit" type="submit" disabled={busy}>{busy?"Verificando acceso…":<>Entrar de forma segura <LogIn size={16}/></>}</button></form>
  <div className="login-secure"><ShieldCheck size={14}/><span>Sesión protegida · Solo personal autorizado</span></div>
 </section><footer className="login-footer">DARKPHONE <span>·</span> TECNOLOGÍA CONFIABLE, NEGOCIO BAJO CONTROL</footer></main>;
}
