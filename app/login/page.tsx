"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogIn, ShieldCheck, LockKeyhole, Eye, EyeOff, Mail, Smartphone, Settings, Shield } from "lucide-react";
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
 return <main className="login-page login-premium">
  <div className="login-showcase">
   <div className="showcase-topline"><span className="showcase-dot"/> DARKPHONE TECH <span className="showcase-topline-right">EST. INNOVATION</span></div>
   <div className="showcase-center">
    <div className="showcase-emblem"><Image src="/darkphone-mark.svg" alt="DarkPhone" width={220} height={220} priority/></div>
    <div className="showcase-wordmark">DarkPhone</div>
    <p className="showcase-tagline">SERVICIO <i/> TECNOLOGÍA <i/> CONFIANZA</p>
    <p className="showcase-description">Tecnología confiable. Atención experta. Todo bajo control.</p>
   </div>
   <div className="showcase-device" aria-hidden="true"><div className="device device-phone"><span/><b/></div><div className="device device-tablet"><span/><b/></div><div className="device device-laptop"><span/></div></div>
   <div className="showcase-services">
    <div><Smartphone size={23}/><span>REPARACIÓN<br/>ESPECIALIZADA</span></div>
    <div><Settings size={23}/><span>REPUESTOS<br/>DE CALIDAD</span></div>
    <div><Shield size={23}/><span>SOPORTE<br/>PROFESIONAL</span></div>
   </div>
  </div>
  <section className="login-card login-card-premium" aria-labelledby="login-title">
   <div className="login-brand-centered">
    <Image className="login-logo-image" src="/darkphone-mark.svg" alt="Logo de DarkPhone" width={76} height={76} priority/>
    <div className="login-wordmark">DarkPhone</div>
   </div>
   <div className="login-heading"><h1 id="login-title">Qué bueno verte.</h1><p>Inicia sesión para continuar</p></div>
   <form onSubmit={submit} className="login-form">
    <div className="field"><label htmlFor="email">Correo electrónico</label><div className="login-input-icon"><Mail size={18}/><input id="email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></div></div>
    <div className="field"><div className="login-password-label"><label htmlFor="password">Contraseña</label></div><div className="login-input-icon login-password-wrap"><LockKeyhole size={18}/><input id="password" type={showPassword?"text":"password"} autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Tu contraseña"/><button className="login-password-toggle" type="button" onClick={()=>setShowPassword(v=>!v)} aria-label={showPassword?"Ocultar contraseña":"Mostrar contraseña"}>{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></div>
    {error&&<div className="notice login-error" role="alert">{error}</div>}
    <button className="button login-submit" type="submit" disabled={busy}>{busy?"Verificando acceso…":<>Iniciar sesión <LogIn size={17}/></>}</button>
   </form>
   <div className="login-secure"><ShieldCheck size={15}/><span>Sesión protegida · Solo personal autorizado</span></div>
  </section>
  <footer className="login-footer">DARKPHONE <span>·</span> TECNOLOGÍA CONFIABLE, NEGOCIO BAJO CONTROL</footer>
 </main>;
}
