"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { Activity, AlertTriangle, ArrowRight, Bot, Boxes, CalendarClock, CircleDollarSign, RefreshCw, Send, ShieldCheck, Wallet, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Sale = { id: string; sale_number: number; customer_id: string | null; total: number; status: string; created_at: string };
type SaleItem = { sale_id: string; quantity: number; unit_cost: number };
type Product = { id: string; name: string; brand: string | null; model: string | null; stock_quantity: number; min_stock: number; cost_price: number; selling_price: number; active: boolean };
type Order = { id: string; order_number: number; device_name: string; status: string; received_at: string; promised_at: string | null; estimated_cost: number; final_cost: number | null };
type CashSession = { id: string; opening_amount: number; opened_at: string; closed_at: string | null };
type CashMovement = { cash_session_id: string; kind: string; amount: number; created_at: string };
type ManualAccount = { id: string; customer_id: string | null; description: string; total_amount: number; status: string; due_date: string | null };
type Customer = { id: string; full_name: string; phone: string | null };
type ReceivablePayment = { account_id: string | null; sale_id: string | null; amount: number };

const money = (value: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);
const dateKey = (date: Date) => { const y=date.getFullYear(); const m=String(date.getMonth()+1).padStart(2,"0"); const d=String(date.getDate()).padStart(2,"0"); return y+"-"+m+"-"+d; };
const openStatuses = new Set(["received","diagnosing","awaiting_approval","awaiting_parts","in_repair","ready"]);
const questions = [
  { label: "¿Cuánto vendimos hoy y cuál fue la utilidad?", icon: CircleDollarSign, key: "ventas" },
  { label: "¿Qué productos debemos reponer?", icon: Boxes, key: "inventario" },
  { label: "¿Qué órdenes llevan más tiempo sin terminar?", icon: Wrench, key: "ordenes" },
  { label: "¿Qué clientes tienen saldos pendientes?", icon: Activity, key: "cartera" },
  { label: "¿Cuánto dinero debería haber en caja?", icon: Wallet, key: "caja" },
];

export default function AssistantPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<{ title: string; body: string; details: string[]; href?: string } | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [accounts, setAccounts] = useState<ManualAccount[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [receivablePayments, setReceivablePayments] = useState<ReceivablePayment[]>([]);
  const [salePayments, setSalePayments] = useState<ReceivablePayment[]>([]);
  const [updatedAt, setUpdatedAt] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!supabase) { setError("Supabase no está configurado. Configura las variables de entorno para consultar los datos reales."); setLoading(false); return; }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    
    const [salesRes, productsRes, ordersRes, sessionsRes, movementsRes, accountsRes, customersRes, receivablePaymentsRes] = await Promise.all([
      supabase.from("sales").select("id,sale_number,customer_id,total,status,created_at").order("created_at", { ascending: false }).limit(5000),
      supabase.from("products").select("id,name,brand,model,stock_quantity,min_stock,cost_price,selling_price,active").eq("active", true).order("name"),
      supabase.from("service_orders").select("id,order_number,device_name,status,received_at,promised_at,estimated_cost,final_cost").in("status", [...openStatuses]).order("received_at", { ascending: true }),
      supabase.from("cash_sessions").select("id,opening_amount,opened_at,closed_at").order("opened_at", { ascending: false }).limit(50),
      supabase.from("cash_movements").select("cash_session_id,kind,amount,created_at").order("created_at", { ascending: false }).limit(2000),
      supabase.from("receivable_accounts").select("id,customer_id,description,total_amount,status,due_date").neq("status", "cancelled").limit(5000),
      supabase.from("customers").select("id,full_name,phone"),
      supabase.from("receivable_payments").select("account_id,sale_id,amount").limit(5000),
    ]);
    const failures = [salesRes,productsRes,ordersRes,sessionsRes,movementsRes,accountsRes,customersRes,receivablePaymentsRes].filter(r => r.error);
    if (failures.length) setError("Algunos datos no se pudieron consultar. Revisa los permisos o la estructura de Supabase. " + failures.map(r => r.error?.message).join(" · "));
    const saleRows = (salesRes.data ?? []) as Sale[];
    setSales(saleRows);
    setProducts((productsRes.data ?? []) as Product[]);
    setOrders((ordersRes.data ?? []) as Order[]);
    setSessions((sessionsRes.data ?? []) as CashSession[]);
    setMovements((movementsRes.data ?? []) as CashMovement[]);
    setAccounts((accountsRes.data ?? []) as ManualAccount[]);
    setCustomers((customersRes.data ?? []) as Customer[]);
    setReceivablePayments((receivablePaymentsRes.data ?? []) as ReceivablePayment[]);
    const today = dateKey(new Date());
    const todaySaleIds = saleRows.filter(s => s.status === "completed" && dateKey(new Date(s.created_at)) === today).map(s => s.id);
    {
      const [itemsRes, salePayRes] = await Promise.all([
        todaySaleIds.length ? supabase.from("sale_items").select("sale_id,quantity,unit_cost").in("sale_id", todaySaleIds) : Promise.resolve({ data: [], error: null }),
        supabase.from("sale_payments").select("sale_id,amount").limit(5000),
      ]);
      if (itemsRes.error || salePayRes.error) setError(prev => [prev, itemsRes.error?.message, salePayRes.error?.message].filter(Boolean).join(" · "));
      setItems((itemsRes.data ?? []) as SaleItem[]);
      setSalePayments((salePayRes.data ?? []) as ReceivablePayment[]);

    setUpdatedAt(new Date().toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" }));
    setLoading(false); setRefreshing(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const todayMetrics = useMemo(() => {
    const today = dateKey(new Date());
    const completed = sales.filter(s => s.status === "completed" && dateKey(new Date(s.created_at)) === today);
    const total = completed.reduce((sum,s) => sum + Number(s.total),0);
    const ids = new Set(completed.map(s => s.id));
    const cost = items.filter(i => ids.has(i.sale_id)).reduce((sum,i) => sum + Number(i.quantity)*Number(i.unit_cost),0);
    return { count: completed.length, total, cost, gross: total-cost };
  }, [sales,items]);
  const lowStock = useMemo(() => products.filter(p => Number(p.stock_quantity) <= Number(p.min_stock)).sort((a,b) => Number(a.stock_quantity)-Number(b.stock_quantity)),[products]);
  const delayedOrders = useMemo(() => orders.filter(o => {
    const days = (Date.now()-new Date(o.received_at).getTime())/86400000;
    return days >= 3 || (o.promised_at && new Date(o.promised_at).getTime() < Date.now());
  }).sort((a,b) => new Date(a.received_at).getTime()-new Date(b.received_at).getTime()),[orders]);
  const activeCash = sessions.find(s => !s.closed_at) ?? null;
  const cashMetrics = useMemo(() => {
    if (!activeCash) return null;
    const rows = movements.filter(m => m.cash_session_id === activeCash.id);
    const income = rows.filter(m => m.kind === "income").reduce((sum,m) => sum+Number(m.amount),0);
    const out = rows.filter(m => m.kind === "expense" || m.kind === "withdrawal").reduce((sum,m) => sum+Number(m.amount),0);
    return { expected: Number(activeCash.opening_amount)+income-out, income, out };
  },[activeCash,movements]);
  const receivables = useMemo(() => {
    const customerMap = new Map(customers.map(c => [c.id,c]));
    const accountRows = accounts.map(a => {
      const paid = receivablePayments.filter(p => p.account_id === a.id).reduce((sum,p) => sum+Number(p.amount),0);
      return { key:a.id, customer:customerMap.get(a.customer_id ?? "")?.full_name ?? "Cliente sin asociar", label:a.description || "Cuenta manual", balance:Math.max(0,Number(a.total_amount)-paid), due:a.due_date };
    }).filter(a => a.balance > 0);
    const saleMap = new Map<string,number>();
    salePayments.forEach(p => { if(p.sale_id) saleMap.set(p.sale_id,(saleMap.get(p.sale_id)||0)+Number(p.amount)); });
    receivablePayments.forEach(p => { if(p.sale_id) saleMap.set(p.sale_id,(saleMap.get(p.sale_id)||0)+Number(p.amount)); });
    const saleRows = sales.filter(s => s.status === "completed").map(s => {
      const payments = saleMap.get(s.id) ?? 0;
      const customer = customerMap.get(s.customer_id ?? "");
      return { key:s.id,customer:customer?.full_name ?? "Venta #"+s.sale_number,label:"Venta #"+s.sale_number,balance:Math.max(0,Number(s.total)-payments),due:null as string|null };
    }).filter(a => a.balance > 0);
    return [...accountRows,...saleRows].sort((a,b) => b.balance-a.balance);
  },[accounts,customers,receivablePayments,sales,salePayments]);

  async function answerQuestion(raw: string) {
    setQuestion(raw);
    setAsking(true);
    setError("");
    try {
      if (!supabase) throw new Error("Supabase no está configurado.");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) throw new Error("Tu sesión no está activa. Inicia sesión nuevamente.");
      const today = dateKey(new Date());
      const todaySales = sales.filter(s => s.status === "completed" && dateKey(new Date(s.created_at)) === today);
      const context = {
        fechaLocal: today,
        ventasHoy: { cantidad: todayMetrics.count, totalCOP: todayMetrics.total, costoProductosCOP: todayMetrics.cost, margenBrutoEstimadoCOP: todayMetrics.gross },
        productosActivos: products.length,
        productosPorReponer: lowStock.slice(0, 30).map(p => ({ nombre: p.name, marca: p.brand, modelo: p.model, stock: p.stock_quantity, minimo: p.min_stock, costoCOP: p.cost_price, precioCOP: p.selling_price })),
        ordenesAbiertas: orders.slice(0, 80).map(o => ({ numero: o.order_number, equipo: o.device_name, estado: o.status, recibida: o.received_at, prometida: o.promised_at, costoEstimadoCOP: o.estimated_cost, costoFinalCOP: o.final_cost })),
        saldosPendientes: receivables.slice(0, 40).map(r => ({ cliente: r.customer, concepto: r.label, saldoCOP: r.balance, vencimiento: r.due })),
        caja: activeCash && cashMetrics ? { abiertaDesde: activeCash.opened_at, baseCOP: activeCash.opening_amount, ingresosCOP: cashMetrics.income, egresosCOP: cashMetrics.out, efectivoEsperadoCOP: cashMetrics.expected } : null,
        ventasCompletadasHoy: todaySales.length,
        notas: ["La utilidad disponible es solo margen bruto estimado (ventas menos costo de artículos), no utilidad neta.", "Los datos se consultan respetando el acceso del usuario en Supabase.", "No hay teléfonos ni datos de autenticación en el contexto."]
      };
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionData.session.access_token}` },
        body: JSON.stringify({ question: raw, context })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "No se pudo obtener una respuesta de la IA.");
      setAnswer({ title: "Asistente IA", body: payload.answer, details: payload.notes ?? [], href: payload.href });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrió un error al consultar la IA.");
    } finally {
      setAsking(false);
    }
  }
  function submitQuestion(e: FormEvent) { e.preventDefault(); if(question.trim() && !asking) void answerQuestion(question.trim()); }

  return <div className="content">
    <div className="page-head"><div><div className="eyebrow">ASISTENCIA OPERATIVA</div><h1>Asistente del negocio</h1><p>Consulta ventas, inventario, órdenes, cartera y caja desde un solo lugar.</p></div><button className="button secondary" onClick={()=>void load(true)} disabled={loading||refreshing}><RefreshCw size={14}/>{refreshing?"Actualizando…":"Actualizar datos"}</button></div>
    <section className="hero"><div className="eyebrow"><Bot size={14}/> DATOS DEL SISTEMA</div><h2>¿Qué necesitas saber?</h2><p>Elige una pregunta o escríbela. Usa IA generativa para razonar sobre tus preguntas y los datos operativos disponibles. Es de solo lectura y no modifica operaciones.</p><form onSubmit={submitQuestion} className="assistant-question"><input value={question} onChange={e=>setQuestion(e.target.value)} placeholder="Ej. ¿Qué productos debo reponer?" aria-label="Pregunta para el asistente"/><button className="button" disabled={!question.trim()||loading||asking}><Send size={14}/>{asking?" Pensando…":" Consultar"}</button></form>{updatedAt&&<small className="service-footnote">Datos actualizados a las {updatedAt}.</small>}</section>
    {error&&<div className="notice service-error" role="alert">{error}</div>}
    <div className="grid assistant-questions">{questions.map(item=>{const Icon=item.icon;return <button key={item.key} className="panel assistant-question-card" onClick={()=>{setQuestion(item.label);void answerQuestion(item.label)}} disabled={loading||asking}><Icon size={18}/><span>{item.label}</span><ArrowRight size={15}/></button>})}</div>
    {loading?<div className="panel empty">Consultando los datos de Darkphone Tech…</div>:asking?<div className="panel empty">La IA está analizando tu pregunta y los datos disponibles…</div>:answer&&<section className="panel assistant-answer"><div className="panel-head"><div><div className="eyebrow">RESPUESTA</div><h2>{answer.title}</h2></div><ShieldCheck size={20}/></div><p>{answer.body}</p>{answer.details.length>0&&<ul className="assistant-answer-list">{answer.details.map((d,i)=><li key={i}>{d}</li>)}</ul>}{answer.href&&<Link className="button secondary" href={answer.href}>Abrir módulo <ArrowRight size={14}/></Link>}</section>}
    <div className="grid stats"><article className="stat"><label><Boxes size={14}/> Referencias por reponer</label><strong>{loading?"—":lowStock.length}</strong><small>Stock actual ≤ mínimo configurado</small></article><article className="stat"><label><Wrench size={14}/> Órdenes abiertas</label><strong>{loading?"—":orders.length}</strong><small>Sin entregar ni cancelar</small></article><article className="stat"><label><CalendarClock size={14}/> Órdenes demoradas</label><strong>{loading?"—":delayedOrders.length}</strong><small>3 días o fecha prometida vencida</small></article><article className="stat"><label><AlertTriangle size={14}/> Estado de caja</label><strong>{loading?"—":activeCash?"Abierta":"Cerrada"}</strong><small>{activeCash&&cashMetrics?money(cashMetrics.expected):"Sin turno activo"}</small></article></div>
    <p className="service-footnote">Nota: el margen mostrado es bruto estimado, no utilidad neta. La cartera automática de ventas se calcula con los pagos registrados en sale_payments; las cuentas manuales usan sus abonos registrados.</p>
  </div>;
}
