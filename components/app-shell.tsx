"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Activity, Boxes, ShoppingCart, Wrench, Users, Wallet, Receipt, CreditCard, ShieldCheck, ChartNoAxesCombined, Sparkles, LayoutDashboard, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";

const links=[{href:"/",label:"Inicio",icon:LayoutDashboard},{href:"/inventario",label:"Inventario",icon:Boxes},{href:"/ventas",label:"Ventas",icon:ShoppingCart},{href:"/servicio-tecnico",label:"Servicio técnico",icon:Wrench},{href:"/clientes",label:"Clientes",icon:Users},{href:"/caja",label:"Caja e ingresos",icon:Wallet},{href:"/gastos",label:"Gastos",icon:Receipt},{href:"/cuentas-por-cobrar",label:"Cuentas por cobrar",icon:CreditCard},{href:"/garantias",label:"Garantías",icon:ShieldCheck},{href:"/reportes",label:"Reportes",icon:ChartNoAxesCombined},{href:"/asistente",label:"Asistente IA",icon:Sparkles}];

export default function AppShell({children}:{children:ReactNode}){
  const pathname=usePathname();
  const router=useRouter();
  const [checking,setChecking]=useState(true);
  const [authenticated,setAuthenticated]=useState(false);
  const [email,setEmail]=useState("");

  useEffect(()=>{
    if(pathname==="/login"){setChecking(false);return;}
    if(!supabase){setChecking(false);setAuthenticated(false);return;}
    let alive=true;
    supabase.auth.getSession().then(({data})=>{
      if(!alive)return;
      setAuthenticated(Boolean(data.session));
      setEmail(data.session?.user.email??"");
      setChecking(false);
      if(!data.session)router.replace("/login");
    });
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>{
      setAuthenticated(Boolean(session));
      setEmail(session?.user.email??"");
      if(!session && pathname!=="/login")router.replace("/login");
    });
    return ()=>{alive=false;subscription.unsubscribe();};
  },[pathname,router]);

  if(pathname==="/login")return <>{children}</>;
  if(checking || !authenticated)return <div className="auth-loading">Verificando acceso a Darkphone Tech…</div>;

  async function signOut(){
    if(supabase)await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  return <div className="app"><aside className="sidebar"><div className="brand"><div className="brand-mark"><Activity size={20}/></div><div><strong>Darkphone Tech</strong><small>Gestión del negocio</small></div></div><div className="nav-label">OPERACIÓN</div><nav className="nav">{links.map(item=>{const Icon=item.icon;const active=item.href==="/" ? pathname==="/" : pathname===item.href||pathname.startsWith(item.href+"/");return <Link key={item.href} href={item.href} className={active?"active":""}><Icon size={15}/>{item.label}</Link>})}</nav><div className="sidebar-foot"><b>Sesión iniciada</b><br/><span>{email}</span><button type="button" className="button secondary logout-button" onClick={signOut}><LogOut size={14}/> Cerrar sesión</button></div></aside><main className="main"><header className="topbar"><span>Centro de operaciones　/　{links.find(x=>x.href===pathname)?.label??"Gestión"}</span><span className="status">● Sesión segura</span></header>{children}</main></div>;
}
