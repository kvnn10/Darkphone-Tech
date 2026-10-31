"use client";
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabase} from "@/lib/supabase";
import {ChartNoAxesCombined,RefreshCw,CalendarDays,Package,Wallet,Wrench} from "lucide-react";
const money=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(Number(n)||0);
const localToday=()=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
type Ledger={movement_date:string;direction:"income"|"expense"|"opening"|"adjustment";amount:number;source:string};
export default function Page(){
 const [from,sf]=useState(localToday().slice(0,8)+"01"),[to,st]=useState(localToday()),[loading,sl]=useState(true),[error,se]=useState(""),[sales,ss]=useState<any[]>([]),[items,si]=useState<any[]>([]),[products,sp]=useState<any[]>([]),[ledger,sledger]=useState<Ledger[]>([]),[expenses,sx]=useState<any[]>([]),[orders,so]=useState<any[]>([]),[receipts,sr]=useState<any[]>([]);
 const load=useCallback(async()=>{
  if(!supabase){se("Supabase no configurado.");sl(false);return}
  sl(true);se("");
  const [a,b,c,d,e,f]=await Promise.all([
   supabase.from("sales").select("id,sale_number,total,status,created_at").gte("created_at",from+"T00:00:00-05:00").lte("created_at",to+"T23:59:59-05:00"),
   supabase.from("sale_items").select("sale_id,quantity,unit_cost"),
   supabase.from("products").select("id,name,cost_price,selling_price,stock_quantity"),
   supabase.from("financial_movements").select("movement_date,direction,amount,source").gte("movement_date",from).lte("movement_date",to).limit(10000),
   supabase.from("expenses").select("amount,expense_date").gte("expense_date",from).lte("expense_date",to),
   supabase.from("service_orders").select("id,estimated_cost,final_cost,received_at,status").gte("received_at",from+"T00:00:00-05:00").lte("received_at",to+"T23:59:59-05:00")
  ]);
  const errors=[a.error,b.error,c.error,d.error,e.error,f.error].filter(Boolean);
  if(errors.length)se(errors.map(x=>x?.message).join(" · "));
  ss(a.data??[]);si(b.data??[]);sp(c.data??[]);sledger((d.data??[]) as Ledger[]);sx(e.data??[]);so(f.data??[]);
  const paymentResult=await supabase.from("receivable_payments").select("amount,paid_at").gte("paid_at",from).lte("paid_at",to);
  if(paymentResult.error)se(v=>[v,paymentResult.error?.message].filter(Boolean).join(" · "));
  sr(paymentResult.data??[]);sl(false);
 },[from,to]);
 useEffect(()=>{void load()},[load]);
 const done=sales.filter(s=>s.status==="completed"),ids=new Set(done.map(s=>s.id));
 const total=done.reduce((n,s)=>n+Number(s.total||0),0);
 const cost=items.filter(i=>ids.has(i.sale_id)).reduce((n,i)=>n+Number(i.unit_cost||0)*Number(i.quantity||0),0);
 const stockCost=products.reduce((n,p)=>n+Number(p.cost_price||0)*Number(p.stock_quantity||0),0);
 const stockValue=products.reduce((n,p)=>n+Number(p.selling_price||0)*Number(p.stock_quantity||0),0);
 const income=ledger.filter(m=>m.direction==="income").reduce((n,m)=>n+Number(m.amount||0),0);
 const out=ledger.filter(m=>m.direction==="expense").reduce((n,m)=>n+Number(m.amount||0),0);
 const expense=expenses.reduce((n,e)=>n+Number(e.amount||0),0);
 const service=orders.filter(o=>o.status!=="cancelled").reduce((n,o)=>n+Number(o.final_cost??o.estimated_cost??0),0);
 const receivable=receipts.reduce((n,p)=>n+Number(p.amount||0),0);
 const days=useMemo(()=>{const m=new Map<string,number>();done.forEach(s=>{const day=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s.created_at));m.set(day,(m.get(day)||0)+Number(s.total||0))});return [...m.entries()].sort((a,b)=>a[0].localeCompare(b[0]))},[done]);
 return <div className="content"><div className="page-head"><div><div className="eyebrow">ANÁLISIS DEL NEGOCIO</div><h1>Reportes</h1><p>Compara periodos de ventas, margen, inventario, caja, gastos, cartera y servicio técnico.</p></div><button className="button secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Actualizar</button></div>
 {error&&<div className="notice service-error" role="alert">{error}</div>}
 <section className="panel"><div className="form-grid"><div className="field"><label>Desde</label><input type="date" value={from} max={to} onChange={e=>sf(e.target.value)}/></div><div className="field"><label>Hasta</label><input type="date" value={to} min={from} onChange={e=>st(e.target.value)}/></div></div><button className="button" onClick={()=>void load()} disabled={loading}><CalendarDays size={14}/> Aplicar periodo</button></section>
 <div className="grid stats"><article className="stat"><label>Ventas completadas</label><strong>{money(total)}</strong><small>{done.length} operaciones</small></article><article className="stat"><label>Margen bruto estimado</label><strong>{money(total-cost)}</strong><small>Venta menos costo registrado</small></article><article className="stat"><label>Gastos registrados</label><strong>{money(expense)}</strong></article><article className="stat"><label>Abonos a cartera</label><strong>{money(receivable)}</strong></article></div>
 <div className="grid stats"><article className="stat"><label><Package size={14}/> Inventario a costo</label><strong>{money(stockCost)}</strong></article><article className="stat"><label>Inventario a precio de venta</label><strong>{money(stockValue)}</strong></article><article className="stat"><label><Wallet size={14}/> Flujo neto del libro</label><strong>{money(income-out)}</strong><small>Ingresos menos egresos del libro financiero</small></article><article className="stat"><label><Wrench size={14}/> Servicio técnico</label><strong>{money(service)}</strong><small>{orders.length} órdenes recibidas</small></article></div>
 <section className="panel"><div className="panel-head"><h2><ChartNoAxesCombined size={16}/> Ventas por día</h2></div>{loading?<div className="empty">Cargando…</div>:<div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Ventas</th><th>Operaciones</th><th>Margen bruto</th></tr></thead><tbody>{days.map(([day,value])=>{const ds=done.filter(s=>new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(s.created_at))===day),di=new Set(ds.map(s=>s.id)),dc=items.filter(i=>di.has(i.sale_id)).reduce((n,i)=>n+Number(i.unit_cost||0)*Number(i.quantity||0),0);return <tr key={day}><td>{day}</td><td>{money(value)}</td><td>{ds.length}</td><td>{money(value-dc)}</td></tr>})}</tbody></table></div>}</section>
 <p className="service-footnote">El flujo neto usa el libro financiero consolidado para evitar omitir ventas importadas o sumar dos veces los movimientos espejo de Caja. El margen es estimado con el costo guardado en cada artículo vendido; el inventario usa las existencias actuales.</p></div>
}