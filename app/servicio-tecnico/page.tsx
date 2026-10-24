"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Wrench, Plus, Search, RefreshCw, Clock3, CheckCircle2, Package, CalendarClock, CircleDollarSign, X, Save, ClipboardCheck, Smartphone, ReceiptText, Upload, Image as ImageIcon, Video, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "received"|"diagnosing"|"awaiting_approval"|"awaiting_parts"|"in_repair"|"ready"|"delivered"|"cancelled";
type Customer = {id:string;full_name:string;phone:string|null};
type Product = {id:string;name:string;brand:string|null;model:string|null;sku:string|null;stock_quantity:number;cost_price:number;active:boolean};
type Order = {id:string;order_number:number;customer_id:string|null;device_name:string;serial_number:string|null;reported_fault:string;diagnosis:string|null;work_notes:string|null;status:Status;approval_status:string;estimated_cost:number;final_cost:number|null;parts_cost:number;received_at:string;promised_at:string|null;delivered_at:string|null;customers?:{full_name:string;phone:string|null}|null};
type Part = {id:string;service_order_id:string;product_id:string;quantity:number;unit_cost:number;created_at:string;products?:{name:string;sku:string|null}|null};
type Payment = {id:string;amount:number;method:string;reference:string|null;created_at:string};
type Evidence = {id:string;service_order_id:string;storage_path:string;file_name:string;mime_type:string;file_size:number;category:"initial"|"diagnosis"|"repair"|"delivery";notes:string|null;created_at:string;url?:string};
const evidenceCategories:{value:Evidence["category"];label:string}[]=[{value:"initial",label:"Estado inicial"},{value:"diagnosis",label:"Diagnóstico"},{value:"repair",label:"Proceso de reparación"},{value:"delivery",label:"Entrega"}];
const evidenceBucket="service-order-evidence";
type Draft = {customer_id:string;device_name:string;serial_number:string;reported_fault:string;diagnosis:string;estimated_cost:string;promised_at:string;approval:boolean};
const initialDraft:Draft={customer_id:"",device_name:"",serial_number:"",reported_fault:"",diagnosis:"",estimated_cost:"",promised_at:"",approval:false};
const statuses:{value:Status;label:string}[]=[{value:"received",label:"Recibido"},{value:"diagnosing",label:"En diagnóstico"},{value:"awaiting_approval",label:"Esperando aprobación"},{value:"awaiting_parts",label:"Esperando repuesto"},{value:"in_repair",label:"En reparación"},{value:"ready",label:"Listo para entregar"},{value:"delivered",label:"Entregado"},{value:"cancelled",label:"Cancelado"}];
const paymentMethods=[{value:"cash",label:"Efectivo"},{value:"debit_card",label:"Tarjeta débito"},{value:"credit_card",label:"Tarjeta crédito"},{value:"bank_transfer",label:"Transferencia"},{value:"nequi",label:"Nequi"},{value:"daviplata",label:"Daviplata"},{value:"other",label:"Otro"}];
const fmt=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);
const dateFmt=(s:string|null)=>s?new Date(s).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"}):"Sin fecha";
const statusLabel=(s:string)=>statuses.find(x=>x.value===s)?.label??s;
export default function ServiceTechnicalPage(){
 const [orders,setOrders]=useState<Order[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[products,setProducts]=useState<Product[]>([]);
 const [parts,setParts]=useState<Part[]>([]),[payments,setPayments]=useState<Payment[]>([]),[evidence,setEvidence]=useState<Evidence[]>([]);
 const [selected,setSelected]=useState<string>(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false);
 const [query,setQuery]=useState(""),[statusFilter,setStatusFilter]=useState("all"),[showForm,setShowForm]=useState(false);
 const [draft,setDraft]=useState<Draft>(initialDraft),[message,setMessage]=useState(""),[error,setError]=useState("");
 const [diagnosis,setDiagnosis]=useState(""),[workNotes,setWorkNotes]=useState(""),[finalCost,setFinalCost]=useState("");
 const [partProduct,setPartProduct]=useState(""),[partQuantity,setPartQuantity]=useState("1"),[partNotes,setPartNotes]=useState("");
 const [payAmount,setPayAmount]=useState(""),[payMethod,setPayMethod]=useState("cash"),[payReference,setPayReference]=useState("");
 const [evidenceCategory,setEvidenceCategory]=useState<Evidence["category"]>("initial"),[evidenceNotes,setEvidenceNotes]=useState(""),[evidenceFiles,setEvidenceFiles]=useState<File[]>([]),[uploadingEvidence,setUploadingEvidence]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase){setError("Conecta Supabase para consultar y registrar órdenes de servicio.");setLoading(false);return}
  setLoading(true);setError("");
  const [o,c,p]=await Promise.all([
   supabase.from("service_orders").select("id,order_number,customer_id,device_name,serial_number,reported_fault,diagnosis,work_notes,status,approval_status,estimated_cost,final_cost,parts_cost,received_at,promised_at,delivered_at,customers(full_name,phone)").order("received_at",{ascending:false}).limit(500),
   supabase.from("customers").select("id,full_name,phone").order("full_name").limit(1000),
   supabase.from("products").select("id,name,brand,model,sku,stock_quantity,cost_price,active").eq("active",true).gt("stock_quantity",0).order("name").limit(1000)
  ]);
  if(o.error){setError("No se pudieron cargar las órdenes: "+o.error.message);setOrders([])}else setOrders((o.data??[]) as unknown as Order[]);
  if(c.error){setError("No se pudieron cargar los clientes: "+c.error.message);setCustomers([])}else setCustomers((c.data??[]) as Customer[]);
  if(p.error){setError("No se pudo cargar el inventario: "+p.error.message);setProducts([])}else setProducts((p.data??[]) as Product[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const active=orders.find(o=>o.id===selected)??null;
 const filtered=useMemo(()=>orders.filter(o=>(statusFilter==="all"||o.status===statusFilter)&&[String(o.order_number),o.device_name,o.serial_number,o.reported_fault,o.customers?.full_name,o.customers?.phone].some(v=>v?.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))),[orders,statusFilter,query]);
 const openCount=orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length;
 const waiting=orders.filter(o=>["awaiting_approval","awaiting_parts"].includes(o.status)).length;
 const ready=orders.filter(o=>o.status==="ready").length;
 const revenue=orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.final_cost??o.estimated_cost??0),0);
 const paid=payments.reduce((s,p)=>s+Number(p.amount),0);
 const currentProduct=products.find(p=>p.id===partProduct);
 async function loadEvidence(orderId:string){
  if(!supabase)return;
  const {data,error}=await supabase.from("service_order_evidence").select("id,service_order_id,storage_path,file_name,mime_type,file_size,category,notes,created_at").eq("service_order_id",orderId).order("created_at",{ascending:false});
  if(error){setError("No se pudieron cargar las evidencias: "+error.message);setEvidence([]);return}
  const rows=(data??[]) as Evidence[];
  const signed=await Promise.all(rows.map(async row=>{const {data:link}=await supabase.storage.from(evidenceBucket).createSignedUrl(row.storage_path,1800);return {...row,url:link?.signedUrl}}));
  setEvidence(signed);
 }
 async function uploadEvidence(e:FormEvent){
  e.preventDefault();if(!supabase||!active||!evidenceFiles.length)return;
  const allowed=["image/jpeg","image/png","image/webp","image/heic","image/heif","video/mp4","video/quicktime","video/webm"];
  for(const file of evidenceFiles){if(!allowed.includes(file.type)){setError("Formato no compatible: "+file.name);return}if(file.size>30*1024*1024){setError("Cada archivo debe pesar máximo 30 MB: "+file.name);return}}
  setUploadingEvidence(true);setError("");setMessage("");
  try{for(const file of evidenceFiles){const safe=file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g,"-").slice(-120)||"evidencia";const path=active.id+"/"+crypto.randomUUID()+"-"+safe;
   const {error:upErr}=await supabase.storage.from(evidenceBucket).upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw new Error("Error subiendo "+file.name+": "+upErr.message);
   const {error:rowErr}=await supabase.from("service_order_evidence").insert({service_order_id:active.id,storage_path:path,file_name:file.name,mime_type:file.type,file_size:file.size,category:evidenceCategory,notes:evidenceNotes.trim()||null});
   if(rowErr){await supabase.storage.from(evidenceBucket).remove([path]);throw new Error("No se guardó el registro: "+rowErr.message)}
  }
  setMessage("Evidencias guardadas en la orden #"+active.order_number+".");setEvidenceFiles([]);setEvidenceNotes("");const picker=document.getElementById("service-evidence-files") as HTMLInputElement|null;if(picker)picker.value="";await loadEvidence(active.id);
  }catch(err){setError(err instanceof Error?err.message:"No se pudieron guardar las evidencias.")}finally{setUploadingEvidence(false)}
 }
 async function openOrder(o:Order){
  setSelected(o.id);setDiagnosis(o.diagnosis??"");setWorkNotes(o.work_notes??"");setFinalCost(String(o.final_cost??o.estimated_cost??""));setMessage("");setError("");
  if(!supabase)return;
  const [pa,py]=await Promise.all([
   supabase.from("service_order_parts").select("id,service_order_id,product_id,quantity,unit_cost,created_at,products(name,sku)").eq("service_order_id",o.id).order("created_at",{ascending:false}),
   supabase.from("service_payments").select("id,amount,method,reference,created_at").eq("service_order_id",o.id).order("created_at",{ascending:false})
  ]);
  if(pa.error)setError("No se pudieron cargar los repuestos. Verifica que esté aplicada la migración avanzada: "+pa.error.message);else setParts((pa.data??[]) as unknown as Part[]);
  if(py.error)setError("No se pudieron cargar los abonos: "+py.error.message);else setPayments((py.data??[]) as Payment[]);
  await loadEvidence(o.id);
 }
 function closeDetail(){setSelected("");setParts([]);setPayments([]);setEvidence([]);setEvidenceFiles([]);setMessage("");setError("");}
 async function createOrder(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  if(!draft.device_name.trim()||!draft.reported_fault.trim()){setError("Completa el equipo y la falla reportada.");return}
  setSaving(true);setError("");setMessage("");
  const {data,error}=await supabase.from("service_orders").insert({
   customer_id:draft.customer_id||null,device_name:draft.device_name.trim(),serial_number:draft.serial_number.trim()||null,
   reported_fault:draft.reported_fault.trim(),diagnosis:draft.diagnosis.trim()||null,estimated_cost:Number(draft.estimated_cost)||0,
   promised_at:draft.promised_at?new Date(draft.promised_at+"T12:00:00").toISOString():null,
   status:draft.approval?"awaiting_approval":(draft.diagnosis.trim()?"diagnosing":"received"),
   approval_status:draft.approval?"pending":"not_required"
  }).select("id").single();
  setSaving(false);
  if(error){setError("No se pudo crear la orden: "+error.message);return}
  setMessage("Orden de servicio creada correctamente.");
  setDraft(initialDraft);setShowForm(false);setParts([]);setPayments([]);await load();
  if(data?.id)setSelected(data.id);
 }
 async function saveProgress(e:FormEvent){
  e.preventDefault();if(!supabase||!active)return;
  setSaving(true);setError("");setMessage("");
  const nextFinal=finalCost.trim()===""?null:Number(finalCost);
  if(nextFinal!==null&&(!Number.isFinite(nextFinal)||nextFinal<0)){setSaving(false);setError("El costo final debe ser cero o mayor.");return}
  const {error}=await supabase.from("service_orders").update({diagnosis:diagnosis.trim()||null,work_notes:workNotes.trim()||null,final_cost:nextFinal,updated_at:new Date().toISOString()}).eq("id",active.id);
  setSaving(false);if(error){setError("No se pudieron guardar los cambios: "+error.message);return}
  setMessage("Diagnóstico, notas y costos actualizados.");await load();
 }
 async function changeStatus(status:Status){
  if(!supabase||!active)return;
  if(status==="delivered"&&!window.confirm("¿Marcar esta orden como entregada?"))return;
  setSaving(true);setError("");setMessage("");
  const patch:{status:Status;updated_at:string;delivered_at?:string|null;approval_status?:string}={status,updated_at:new Date().toISOString()};
  if(status==="delivered")patch.delivered_at=new Date().toISOString();
  if(status==="awaiting_approval")patch.approval_status="pending";
  if(status==="in_repair"&&active.approval_status==="pending")patch.approval_status="approved";
  const {error}=await supabase.from("service_orders").update(patch).eq("id",active.id);
  setSaving(false);if(error){setError("No se pudo cambiar el estado: "+error.message);return}
  setMessage("Estado actualizado.");await load();
 }
 async function addPart(e:FormEvent){
  e.preventDefault();if(!supabase||!active||!partProduct)return;
  const quantity=Number(partQuantity);
  if(!Number.isInteger(quantity)||quantity<1){setError("La cantidad del repuesto debe ser un entero positivo.");return}
  setSaving(true);setError("");setMessage("");
  const {error}=await supabase.rpc("consume_service_part",{p_service_order_id:active.id,p_product_id:partProduct,p_quantity:quantity,p_notes:partNotes.trim()||null});
  setSaving(false);
  if(error){setError("No se pudo descontar el repuesto. Verifica la migración avanzada y el stock: "+error.message);return}
  setMessage("Repuesto agregado y descontado del inventario.");setPartProduct("");setPartQuantity("1");setPartNotes("");await load();const fresh=orders.find(o=>o.id===active.id);if(fresh)await openOrder(fresh);
 }
 async function addPayment(e:FormEvent){
  e.preventDefault();if(!supabase||!active)return;
  const amount=Number(payAmount);if(!Number.isFinite(amount)||amount<=0){setError("El abono debe ser mayor que cero.");return}
  setSaving(true);setError("");setMessage("");
  const {error}=await supabase.from("service_payments").insert({service_order_id:active.id,amount,method:payMethod,reference:payReference.trim()||null});
  setSaving(false);if(error){setError("No se pudo registrar el abono: "+error.message);return}
  setMessage("Abono registrado.");setPayAmount("");setPayReference("");
  const {data,error:payError}=await supabase.from("service_payments").select("id,amount,method,reference,created_at").eq("service_order_id",active.id).order("created_at",{ascending:false});
  if(!payError)setPayments((data??[]) as Payment[]);
 }
 function startNew(){setDraft(initialDraft);setShowForm(v=>!v);setError("");setMessage("");}
 return <div className="content service-page">
  <div className="page-head"><div><div className="eyebrow">REPARACIONES Y POSVENTA</div><h1>Servicio técnico</h1><p>Controla cada orden, los repuestos, los abonos y la rentabilidad del servicio.</p></div><div className="service-head-actions"><button className="button secondary" onClick={()=>void load()} disabled={loading}><RefreshCw size={14}/> Actualizar</button><button className="button" onClick={startNew}><Plus size={15}/>{showForm?"Cerrar":"Nueva orden"}</button></div></div>
  {error&&<div className="notice service-error">{error}</div>}{message&&<div className="notice service-success">{message}</div>}
  <div className="grid stats service-stats">
   <article className="stat"><label>Órdenes activas</label><strong>{openCount}</strong><small>En proceso de atención</small></article>
   <article className={"stat "+(waiting?"kpi-warning":"")}><label>Pendientes</label><strong>{waiting}</strong><small>Aprobación o repuestos</small></article>
   <article className="stat"><label>Listas para entregar</label><strong>{ready}</strong><small>Esperan al cliente</small></article>
   <article className="stat"><label>Valor estimado / final</label><strong>{fmt(revenue)}</strong><small>Órdenes no canceladas</small></article>
  </div>
  {showForm&&<section className="panel service-form-panel"><div className="panel-head"><div><h2><Plus size={16}/> Registrar equipo</h2><p>La aprobación del presupuesto es opcional; puedes dejar la orden en diagnóstico.</p></div><button className="icon-button" type="button" onClick={()=>setShowForm(false)} aria-label="Cerrar"><X size={15}/></button></div>
   <form onSubmit={createOrder}><div className="form-grid">
    <div className="field"><label>Cliente</label><select value={draft.customer_id} onChange={e=>setDraft({...draft,customer_id:e.target.value})}><option value="">Sin cliente asociado</option>{customers.map(c=><option key={c.id} value={c.id}>{c.full_name}{c.phone?" · "+c.phone:""}</option>)}</select></div>
    <div className="field"><label>Equipo / marca / modelo *</label><input required maxLength={180} value={draft.device_name} onChange={e=>setDraft({...draft,device_name:e.target.value})} placeholder="Ej. iPhone 13 Pro Max"/></div>
    <div className="field"><label>IMEI o serial</label><input maxLength={120} value={draft.serial_number} onChange={e=>setDraft({...draft,serial_number:e.target.value})} placeholder="Identificador del equipo"/></div>
    <div className="field"><label>Fecha prometida</label><input type="date" value={draft.promised_at} onChange={e=>setDraft({...draft,promised_at:e.target.value})}/></div>
    <div className="field service-full"><label>Falla reportada por el cliente *</label><textarea required rows={2} maxLength={2000} value={draft.reported_fault} onChange={e=>setDraft({...draft,reported_fault:e.target.value})} placeholder="Describe el síntoma o daño reportado"/></div>
    <div className="field service-full"><label>Diagnóstico inicial (opcional)</label><textarea rows={2} maxLength={3000} value={draft.diagnosis} onChange={e=>setDraft({...draft,diagnosis:e.target.value})} placeholder="Pruebas realizadas y falla encontrada"/></div>
    <div className="field"><label>Presupuesto estimado (COP)</label><input type="number" min="0" step="1" value={draft.estimated_cost} onChange={e=>setDraft({...draft,estimated_cost:e.target.value})} placeholder="0"/></div>
    <label className="service-check"><input type="checkbox" checked={draft.approval} onChange={e=>setDraft({...draft,approval:e.target.checked})}/> <span><b>Esperar aprobación del presupuesto</b><small>Si no se marca, la orden se registra sin aprobación pendiente.</small></span></label>
   </div><div className="form-actions"><button className="button secondary" type="button" onClick={()=>setShowForm(false)}>Cancelar</button><button className="button" type="submit" disabled={saving}><Save size={14}/>{saving?"Guardando…":"Crear orden"}</button></div></form>
  </section>}
  <div className="service-layout">
   <section className="panel service-list-panel"><div className="panel-head"><div><h2><Wrench size={16}/> Órdenes de servicio</h2><p>{filtered.length} resultados · historial de reparaciones</p></div></div>
    <div className="service-toolbar"><div className="service-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar orden, equipo, IMEI o cliente…"/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filtrar por estado"><option value="all">Todos los estados</option>{statuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
    {loading?<div className="empty">Cargando órdenes…</div>:filtered.length===0?<div className="empty service-empty"><Wrench size={22}/><b>No hay órdenes para mostrar</b><span>Registra una nueva orden o cambia los filtros.</span></div>:<div className="service-order-list">{filtered.map(o=><button type="button" key={o.id} className={"service-order-row "+(selected===o.id?"selected":"")} onClick={()=>void openOrder(o)}><span className="service-order-icon"><Smartphone size={17}/></span><span className="service-order-main"><b>#{o.order_number} · {o.device_name}</b><small>{o.customers?.full_name??"Sin cliente"}{o.serial_number?" · "+o.serial_number:""}</small><small>{dateFmt(o.received_at)}</small></span><span className={"service-status status-"+o.status}>{statusLabel(o.status)}</span></button>)}</div>}
   </section>
   <section className="panel service-detail-panel">{!active?<div className="service-detail-empty"><ClipboardCheck size={30}/><h2>Detalle de la orden</h2><p>Selecciona una orden para editar el diagnóstico, cambiar su estado, gestionar repuestos y registrar abonos.</p></div>:<div className="service-detail">
    <div className="service-detail-head"><div><span className="eyebrow">ORDEN #{active.order_number}</span><h2>{active.device_name}</h2><p>{active.customers?.full_name??"Sin cliente asociado"}{active.customers?.phone?" · "+active.customers.phone:""}</p></div><button className="icon-button" type="button" onClick={closeDetail} aria-label="Cerrar detalle"><X size={15}/></button></div>
    <div className="service-device-meta"><span><Smartphone size={14}/>{active.serial_number||"Sin IMEI / serial"}</span><span><CalendarClock size={14}/>Recibido: {dateFmt(active.received_at)}</span><span><Clock3 size={14}/>Prometido: {dateFmt(active.promised_at)}</span></div>
    <div className="service-status-control"><label>Estado de la orden</label><select value={active.status} disabled={saving||active.status==="cancelled"} onChange={e=>void changeStatus(e.target.value as Status)}>{statuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
    {active.status==="awaiting_approval"&&<div className="service-approval-note"><Clock3 size={15}/><span>Presupuesto pendiente de aprobación. Para continuar, cambia el estado a «En reparación» cuando el cliente autorice.</span></div>}
    <form className="service-progress-form" onSubmit={saveProgress}><div className="field"><label>Falla reportada</label><div className="service-reported-fault">{active.reported_fault}</div></div><div className="field"><label>Diagnóstico</label><textarea rows={3} value={diagnosis} onChange={e=>setDiagnosis(e.target.value)} placeholder="Hallazgos y pruebas realizadas"/></div><div className="field"><label>Trabajo realizado / notas técnicas</label><textarea rows={3} value={workNotes} onChange={e=>setWorkNotes(e.target.value)} placeholder="Reparación realizada, pruebas finales, observaciones"/></div><div className="field"><label>Costo final al cliente (COP)</label><input type="number" min="0" step="1" value={finalCost} onChange={e=>setFinalCost(e.target.value)} placeholder="0"/></div><button className="button secondary service-save-progress" type="submit" disabled={saving}><Save size={13}/> Guardar diagnóstico y costos</button></form>
    <div className="service-subsection service-evidence-section"><div className="service-subsection-head"><h3><ImageIcon size={15}/> Fotos y videos del equipo</h3><span>{evidence.length} archivos</span></div>
     <p className="service-footnote">Adjunta evidencia al recibir el equipo y durante el diagnóstico, reparación o entrega. Los archivos se guardan de forma privada en esta orden.</p>
     {evidence.length>0?<div className="service-evidence-grid">{evidence.map(item=><article className="service-evidence-card" key={item.id}>
      <a className="service-evidence-preview" href={item.url||undefined} target="_blank" rel="noreferrer" aria-label={"Abrir "+item.file_name}>
       {item.mime_type.startsWith("video/")?<span className="service-evidence-file"><Video size={25}/><small>VIDEO</small></span>:item.url?<img src={item.url} alt={item.file_name}/>:<span className="service-evidence-file"><ImageIcon size={25}/></span>}
       <span className="service-evidence-open"><ExternalLink size={13}/></span>
      </a><div className="service-evidence-info"><b>{item.file_name}</b><span>{evidenceCategories.find(x=>x.value===item.category)?.label??item.category} · {(item.file_size/1048576).toFixed(1)} MB</span>{item.notes&&<small>{item.notes}</small>}<small>{new Date(item.created_at).toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"})}</small></div>
     </article>)}</div>:<div className="service-evidence-empty"><ImageIcon size={20}/><span>Aún no hay fotos ni videos en esta orden.</span></div>}
     {!["delivered","cancelled"].includes(active.status)&&<form className="service-evidence-form" onSubmit={uploadEvidence}><div className="form-grid">
      <div className="field"><label>Tipo de evidencia</label><select value={evidenceCategory} onChange={e=>setEvidenceCategory(e.target.value as Evidence["category"])}>{evidenceCategories.map(cat=><option key={cat.value} value={cat.value}>{cat.label}</option>)}</select></div>
      <div className="field"><label>Fotos o videos (máx. 30 MB cada uno)</label><input id="service-evidence-files" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,video/webm" multiple onChange={e=>setEvidenceFiles(Array.from(e.target.files??[]))}/><small>Seleccionados: {evidenceFiles.length}</small></div>
      <div className="field service-full"><label>Observaciones</label><input maxLength={500} value={evidenceNotes} onChange={e=>setEvidenceNotes(e.target.value)} placeholder="Ej. fisura en esquina superior derecha"/></div>
     </div><button className="button secondary" type="submit" disabled={uploadingEvidence||saving||evidenceFiles.length===0}><Upload size={14}/>{uploadingEvidence?"Subiendo archivos…":"Guardar evidencias"}</button></form>}
    </div>
    <div className="service-finance-grid"><div><small>Presupuesto</small><b>{fmt(Number(active.estimated_cost))}</b></div><div><small>Repuestos</small><b>{fmt(Number(active.parts_cost))}</b></div><div><small>Abonado</small><b>{fmt(paid)}</b></div><div><small>Saldo estimado</small><b className={paid>Number(active.final_cost??active.estimated_cost)?"success":""}>{fmt(Math.max(0,Number(active.final_cost??active.estimated_cost)-paid))}</b></div></div>
    <div className="service-subsection"><div className="service-subsection-head"><h3><Package size={15}/> Repuestos utilizados</h3><span>{parts.length} líneas</span></div>
     {parts.length>0&&<div className="service-part-list">{parts.map(p=><div key={p.id}><span><b>{p.products?.name??"Repuesto"}</b><small>{p.quantity} × {fmt(Number(p.unit_cost))}</small></span><strong>{fmt(Number(p.quantity)*Number(p.unit_cost))}</strong></div>)}</div>}
     {!["delivered","cancelled"].includes(active.status)&&<form className="service-inline-form" onSubmit={addPart}><div className="field service-full"><label>Seleccionar repuesto (descuenta inventario)</label><select required value={partProduct} onChange={e=>setPartProduct(e.target.value)}><option value="">Buscar en el listado de existencias…</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}{p.sku?" · "+p.sku:""} · Stock {p.stock_quantity}</option>)}</select></div><div className="field"><label>Cantidad</label><input type="number" min="1" max={currentProduct?.stock_quantity??undefined} step="1" value={partQuantity} onChange={e=>setPartQuantity(e.target.value)}/></div><div className="field"><label>Nota (opcional)</label><input value={partNotes} onChange={e=>setPartNotes(e.target.value)} placeholder="Ej. cambio de pantalla"/></div><button className="button secondary" type="submit" disabled={saving||!partProduct}><Plus size={13}/> Usar repuesto</button></form>}
     <p className="service-footnote">El descuento se registra con un movimiento de inventario y el costo queda asociado a esta orden.</p>
    </div>
    <div className="service-subsection"><div className="service-subsection-head"><h3><CircleDollarSign size={15}/> Abonos del cliente</h3><span>{payments.length} movimientos</span></div>
     {payments.length>0&&<div className="service-part-list">{payments.map(p=><div key={p.id}><span><b>{fmt(Number(p.amount))} · {paymentMethods.find(m=>m.value===p.method)?.label??p.method}</b><small>{dateFmt(p.created_at)}{p.reference?" · "+p.reference:""}</small></span><CheckCircle2 size={15} className="success"/></div>)}</div>}
     {!["delivered","cancelled"].includes(active.status)&&<form className="service-inline-form" onSubmit={addPayment}><div className="field"><label>Valor del abono (COP)</label><input type="number" min="1" step="1" required value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="0"/></div><div className="field"><label>Medio de pago</label><select value={payMethod} onChange={e=>setPayMethod(e.target.value)}>{paymentMethods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></div><div className="field service-full"><label>Referencia (opcional)</label><input value={payReference} onChange={e=>setPayReference(e.target.value)} placeholder="Número de transacción"/></div><button className="button secondary" type="submit" disabled={saving}><Plus size={13}/> Registrar abono</button></form>}
    </div>
    <div className="service-profit"><div><small>Utilidad bruta estimada</small><b>{fmt(Number(active.final_cost??active.estimated_cost)-Number(active.parts_cost))}</b><span>Valor cobrado/estimado menos costo de repuestos; no incluye mano de obra ni otros gastos.</span></div><ReceiptText size={21}/></div>
   </div>}</section>
  </div>
 </div>;
}
