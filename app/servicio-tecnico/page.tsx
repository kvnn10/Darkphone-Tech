"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Wrench, Plus, Search, RefreshCw, Clock3, CheckCircle2, Package, CalendarClock, CircleDollarSign, X, Save, ClipboardCheck, Smartphone, ReceiptText, Upload, Image as ImageIcon, Video, ExternalLink, Trash2, AlertTriangle, MousePointerClick } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Status = "received"|"diagnosing"|"awaiting_approval"|"awaiting_parts"|"in_repair"|"ready"|"delivered"|"cancelled";
type Customer = {id:string;full_name:string;phone:string|null};
type Product = {id:string;name:string;brand:string|null;model:string|null;sku:string|null;stock_quantity:number;cost_price:number;active:boolean};
type Order = {id:string;order_number:number;customer_id:string|null;device_name:string;serial_number:string|null;reported_fault:string;diagnosis:string|null;work_notes:string|null;device_condition:string|null;accessories:string|null;intake_checklist:Record<string,boolean>|null;status:Status;approval_status:string;estimated_cost:number;final_cost:number|null;parts_cost:number;received_at:string;promised_at:string|null;delivered_at:string|null;customers?:{full_name:string;phone:string|null}|null};
type Part = {id:string;service_order_id:string;product_id:string;quantity:number;unit_cost:number;created_at:string;products?:{name:string;sku:string|null}|null};
type Payment = {id:string;amount:number;method:string;reference:string|null;created_at:string};
type Evidence = {id:string;service_order_id:string;storage_path:string;file_name:string;mime_type:string;file_size:number;category:"initial"|"diagnosis"|"repair"|"delivery";notes:string|null;created_at:string;url?:string};
const evidenceCategories:{value:Evidence["category"];label:string}[]=[{value:"initial",label:"Estado inicial"},{value:"diagnosis",label:"Diagnóstico"},{value:"repair",label:"Proceso de reparación"},{value:"delivery",label:"Entrega"}];
const evidenceBucket="service-order-evidence";
type Draft = {customer_id:string;device_name:string;serial_number:string;access_code:string;reported_fault:string;diagnosis:string;estimated_cost:string;promised_at:string;device_condition:string;accessories:string;intake_checklist:Record<string,boolean>;approval:boolean};
const intakeChecks=[{key:"screen",label:"Pantalla revisada"},{key:"frame",label:"Carcasa y bordes revisados"},{key:"powers_on",label:"Enciende al recibir"},{key:"camera",label:"Cámaras revisadas"},{key:"ports",label:"Puertos y botones revisados"},{key:"water_damage",label:"Humedad revisada"}];
const initialDraft:Draft={customer_id:"",device_name:"",serial_number:"",access_code:"",reported_fault:"",diagnosis:"",estimated_cost:"",promised_at:"",device_condition:"",accessories:"",intake_checklist:{},approval:false};
const statuses:{value:Status;label:string}[]=[{value:"received",label:"Recibido"},{value:"diagnosing",label:"En diagnóstico"},{value:"awaiting_approval",label:"Esperando aprobación"},{value:"awaiting_parts",label:"Esperando repuesto"},{value:"in_repair",label:"En reparación"},{value:"ready",label:"Listo para entregar"},{value:"delivered",label:"Entregado"},{value:"cancelled",label:"Cancelado"}];
const paymentMethods=[{value:"cash",label:"Efectivo"},{value:"debit_card",label:"Tarjeta débito"},{value:"credit_card",label:"Tarjeta crédito"},{value:"bank_transfer",label:"Transferencia"},{value:"nequi",label:"Nequi"},{value:"daviplata",label:"Daviplata"},{value:"other",label:"Otro"}];
const fmt=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);
const dateFmt=(s:string|null)=>s?new Date(s).toLocaleDateString("es-CO",{day:"2-digit",month:"short",year:"numeric"}):"Sin fecha";
const statusLabel=(s:string)=>statuses.find(x=>x.value===s)?.label??s;
export default function ServiceTechnicalPage(){
 const [orders,setOrders]=useState<Order[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[products,setProducts]=useState<Product[]>([]);
 const [parts,setParts]=useState<Part[]>([]),[payments,setPayments]=useState<Payment[]>([]),[evidence,setEvidence]=useState<Evidence[]>([]);
 const [accessCode,setAccessCode]=useState(""),[showAccessCode,setShowAccessCode]=useState(false),[editingAccessCode,setEditingAccessCode]=useState(false),[accessCodeDraft,setAccessCodeDraft]=useState("");
 const [selected,setSelected]=useState<string>(""),[loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[showReceipt,setShowReceipt]=useState(false);
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
   supabase.from("service_orders").select("id,order_number,customer_id,device_name,serial_number,reported_fault,diagnosis,work_notes,device_condition,accessories,intake_checklist,status,approval_status,estimated_cost,final_cost,parts_cost,received_at,promised_at,delivered_at,customers(full_name,phone)").order("received_at",{ascending:false}).limit(500),
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
 const workflowStatuses:Status[]=["received","diagnosing","awaiting_approval","awaiting_parts","in_repair","ready","delivered"];
 const nextStep:Partial<Record<Status,{status:Status;label:string;hint:string}>>={
  received:{status:"diagnosing",label:"Iniciar diagnóstico",hint:"Registra las pruebas y el diagnóstico del equipo."},
  diagnosing:{status:active?.approval_status==="pending"?"awaiting_approval":"in_repair",label:active?.approval_status==="pending"?"Solicitar aprobación":"Iniciar reparación",hint:active?.approval_status==="pending"?"No repares hasta que el cliente autorice el presupuesto.":"Guarda el diagnóstico antes de empezar la reparación."},
  awaiting_approval:{status:"in_repair",label:"Cliente aprobó · iniciar reparación",hint:"Usa esta acción solo después de recibir la autorización del cliente."},
  awaiting_parts:{status:"in_repair",label:"Repuesto recibido · continuar",hint:"Confirma que el repuesto ya llegó antes de continuar."},
  in_repair:{status:"ready",label:"Marcar listo para entregar",hint:"Confirma las pruebas finales y guarda las notas técnicas."},
  ready:{status:"delivered",label:"Registrar entrega",hint:"Verifica el saldo y confirma la entrega al cliente."}
 };
 const checklistLabels=[{key:"screen",label:"Pantalla revisada"},{key:"frame",label:"Carcasa y bordes revisados"},{key:"powers_on",label:"Enciende al recibir"},{key:"camera",label:"Cámaras revisadas"},{key:"ports",label:"Puertos y botones revisados"},{key:"water_damage",label:"Humedad revisada"}];
 function printReceipt(){if(!active)return;setShowReceipt(true);window.setTimeout(()=>window.print(),250);}
 const filtered=useMemo(()=>orders.filter(o=>(statusFilter==="all"||o.status===statusFilter)&&[String(o.order_number),o.device_name,o.serial_number,o.reported_fault,o.customers?.full_name,o.customers?.phone].some(v=>v?.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es")))),[orders,statusFilter,query]);
 const openCount=orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length;
 const waiting=orders.filter(o=>["awaiting_approval","awaiting_parts"].includes(o.status)).length;
 const ready=orders.filter(o=>o.status==="ready").length;
 const revenue=orders.filter(o=>o.status!=="cancelled").reduce((s,o)=>s+Number(o.final_cost??o.estimated_cost??0),0);
 const paid=payments.reduce((s,p)=>s+Number(p.amount),0);
 const currentProduct=products.find(p=>p.id===partProduct);
 async function loadEvidence(orderId:string){
  const client=supabase;
  if(!client)return;
  const {data,error}=await client.from("service_order_evidence").select("id,service_order_id,storage_path,file_name,mime_type,file_size,category,notes,created_at").eq("service_order_id",orderId).order("created_at",{ascending:false});
  if(error){setError("No se pudieron cargar las evidencias: "+error.message);setEvidence([]);return}
  const rows=(data??[]) as Evidence[];
  const signed=await Promise.all(rows.map(async row=>{const {data:link}=await client.storage.from(evidenceBucket).createSignedUrl(row.storage_path,1800);return {...row,url:link?.signedUrl}}));
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
  setSelected(o.id);setDiagnosis(o.diagnosis??"");setWorkNotes(o.work_notes??"");setFinalCost(String(o.final_cost??o.estimated_cost??""));setAccessCode("");setShowAccessCode(false);setEditingAccessCode(false);setAccessCodeDraft("");setMessage("");setError("");
  if(!supabase)return;
  const [pa,py,credential]=await Promise.all([
   supabase.from("service_order_parts").select("id,service_order_id,product_id,quantity,unit_cost,created_at,products(name,sku)").eq("service_order_id",o.id).order("created_at",{ascending:false}),
   supabase.from("service_payments").select("id,amount,method,reference,created_at").eq("service_order_id",o.id).order("created_at",{ascending:false}),
   supabase.from("device_access_credentials").select("access_code").eq("service_order_id",o.id).maybeSingle()
  ]);
  if(credential.error)setError("No se pudo consultar la clave (verifica tus permisos): "+credential.error.message);else {setAccessCode(credential.data?.access_code??"");setAccessCodeDraft(credential.data?.access_code??"");}
  if(pa.error)setError("No se pudieron cargar los repuestos. Verifica que esté aplicada la migración avanzada: "+pa.error.message);else setParts((pa.data??[]) as unknown as Part[]);
  if(py.error)setError("No se pudieron cargar los abonos: "+py.error.message);else setPayments((py.data??[]) as Payment[]);
  await loadEvidence(o.id);
 }
 function closeDetail(){setSelected("");setParts([]);setPayments([]);setEvidence([]);setEvidenceFiles([]);setAccessCode("");setShowAccessCode(false);setEditingAccessCode(false);setAccessCodeDraft("");setMessage("");setError("");}
 async function deleteOrder(){
  if(!supabase||!active||saving)return;
  const order=active;
  if(order.status==="delivered"){setError("Las órdenes entregadas se conservan como historial y no se pueden eliminar.");return}
  const typed=window.prompt("Vas a eliminar la orden #"+order.order_number+" ("+order.device_name+").\n\nPara confirmar, escribe el número "+order.order_number+".");
  if(typed===null)return;
  if(typed.trim()!==String(order.order_number)){setError("No se eliminó: el número de orden no coincide.");return}
  setSaving(true);setError("");setMessage("");
  const [partCheck,paymentCheck,evidenceCheck]=await Promise.all([
   supabase.from("service_order_parts").select("id",{count:"exact",head:true}).eq("service_order_id",order.id),
   supabase.from("service_payments").select("id",{count:"exact",head:true}).eq("service_order_id",order.id),
   supabase.from("service_order_evidence").select("id",{count:"exact",head:true}).eq("service_order_id",order.id)
  ]);
  const checkError=partCheck.error??paymentCheck.error??evidenceCheck.error;
  if(checkError){setSaving(false);setError("No se pudo verificar si la orden tiene movimientos asociados. No se eliminó. "+checkError.message);return}
  if((partCheck.count??0)>0||(paymentCheck.count??0)>0||(evidenceCheck.count??0)>0){
   setSaving(false);
   setError("Esta orden tiene "+((partCheck.count??0)>0?"repuestos descontados del inventario":"")+((partCheck.count??0)>0&&(paymentCheck.count??0)>0?" y ":"") + ((paymentCheck.count??0)>0?"abonos registrados":"") + (((partCheck.count??0)>0||(paymentCheck.count??0)>0)&&(evidenceCheck.count??0)>0?" y ":"") + ((evidenceCheck.count??0)>0?"fotos o videos adjuntos":"")+". Para conservar el historial y la trazabilidad, no se puede eliminar. Si ya no debe continuar, cambia su estado a «Cancelado».");return
  }
  const {error:credentialError}=await supabase.from("device_access_credentials").delete().eq("service_order_id",order.id);
  if(credentialError){setSaving(false);setError("No se pudo preparar la eliminación de la clave del equipo: "+credentialError.message);return}
  const {error:deleteError}=await supabase.from("service_orders").delete().eq("id",order.id);
  setSaving(false);
  if(deleteError){setError("No se pudo eliminar la orden. Verifica tus permisos: "+deleteError.message);return}
  closeDetail();setMessage("La orden #"+order.order_number+" fue eliminada.");await load();
 }

 async function saveAccessCode(){
  if(!supabase||!active)return;
  setSaving(true);setError("");setMessage("");
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user){setSaving(false);setError("Inicia sesión para guardar la clave.");return}
  const payload={service_order_id:active.id,access_code:accessCodeDraft.trim(),updated_by:user.id};
  let result;
  if(!payload.access_code){setSaving(false);setError("Escribe una clave o patrón antes de guardar.");return}
  if(accessCode){result=await supabase.from("device_access_credentials").update({access_code:payload.access_code,updated_by:user.id,updated_at:new Date().toISOString()}).eq("service_order_id",active.id)}
  else result=await supabase.from("device_access_credentials").insert({...payload,created_by:user.id});
  setSaving(false);
  if(result?.error){setError("No se pudo guardar la clave: "+result.error.message);return}
  setAccessCode(payload.access_code);setAccessCodeDraft(payload.access_code);setShowAccessCode(false);setEditingAccessCode(false);setMessage("Clave de desbloqueo guardada.");
 }
 async function createOrder(e:FormEvent){
  e.preventDefault();if(!supabase)return;
  if(!draft.device_name.trim()||!draft.reported_fault.trim()){setError("Completa el equipo y la falla reportada.");return}
  setSaving(true);setError("");setMessage("");
  const {data,error}=await supabase.from("service_orders").insert({
   customer_id:draft.customer_id||null,device_name:draft.device_name.trim(),serial_number:draft.serial_number.trim()||null,
   reported_fault:draft.reported_fault.trim(),diagnosis:draft.diagnosis.trim()||null,device_condition:draft.device_condition.trim()||null,accessories:draft.accessories.trim()||null,intake_checklist:draft.intake_checklist,estimated_cost:Number(draft.estimated_cost)||0,
   promised_at:draft.promised_at?new Date(draft.promised_at+"T12:00:00").toISOString():null,
   status:draft.approval?"awaiting_approval":(draft.diagnosis.trim()?"diagnosing":"received"),
   approval_status:draft.approval?"pending":"not_required"
  }).select("id").single();
  setSaving(false);
  if(error){setSaving(false);setError("No se pudo crear la orden: "+error.message);return}
  if(draft.access_code.trim()&&data?.id){const {data:{user}}=await supabase.auth.getUser();const {error:credentialError}=await supabase.from("device_access_credentials").insert({service_order_id:data.id,access_code:draft.access_code.trim(),created_by:user?.id??null});if(credentialError){setSaving(false);setError("La orden se creó, pero no se pudo guardar la clave: "+credentialError.message);await load();return}}
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
    <div className="field"><label>Estado físico al recibir</label><input maxLength={1000} value={draft.device_condition} onChange={e=>setDraft({...draft,device_condition:e.target.value})} placeholder="Ej. vidrio fisurado, marco con golpes"/></div>
    <div className="field"><label>Accesorios recibidos</label><input maxLength={500} value={draft.accessories} onChange={e=>setDraft({...draft,accessories:e.target.value})} placeholder="Ej. solo equipo, sin cargador"/></div>
    <div className="field service-full"><label>Checklist de recepción</label><div className="service-intake-checklist">{intakeChecks.map(item=><label className="service-check" key={item.key}><input type="checkbox" checked={!!draft.intake_checklist[item.key]} onChange={e=>setDraft({...draft,intake_checklist:{...draft.intake_checklist,[item.key]:e.target.checked}})}/><span>{item.label}</span></label>)}</div><small>Marca solo lo que hayas comprobado al recibir el equipo.</small></div>
    <div className="field"><label>Clave / patrón (opcional)</label><input type="password" autoComplete="off" maxLength={120} value={draft.access_code} onChange={e=>setDraft({...draft,access_code:e.target.value})} placeholder="Solo personal autorizado"/></div>
    <div className="field"><label>Fecha prometida</label><input type="date" value={draft.promised_at} onChange={e=>setDraft({...draft,promised_at:e.target.value})}/></div>
    <div className="field service-full"><label>Falla reportada por el cliente *</label><textarea required rows={2} maxLength={2000} value={draft.reported_fault} onChange={e=>setDraft({...draft,reported_fault:e.target.value})} placeholder="Describe el síntoma o daño reportado"/></div>
    <div className="field service-full"><label>Diagnóstico inicial (opcional)</label><textarea rows={2} maxLength={3000} value={draft.diagnosis} onChange={e=>setDraft({...draft,diagnosis:e.target.value})} placeholder="Pruebas realizadas y falla encontrada"/></div>
    <div className="field"><label>Presupuesto estimado (COP)</label><input type="number" min="0" step="1" value={draft.estimated_cost} onChange={e=>setDraft({...draft,estimated_cost:e.target.value})} placeholder="0"/></div>
    <label className="service-check"><input type="checkbox" checked={draft.approval} onChange={e=>setDraft({...draft,approval:e.target.checked})}/> <span><b>Esperar aprobación del presupuesto</b><small>Si no se marca, la orden se registra sin aprobación pendiente.</small></span></label>
   </div><div className="form-actions"><button className="button secondary" type="button" onClick={()=>setShowForm(false)}>Cancelar</button><button className="button" type="submit" disabled={saving}><Save size={14}/>{saving?"Guardando…":"Crear orden"}</button></div></form>
  </section>}
  <div className="service-layout">
   <section className="panel service-list-panel"><div className="panel-head"><div><h2><Wrench size={16}/> Órdenes de servicio</h2><p>{filtered.length} resultados · selecciona una fila para abrirla</p></div></div>
    <div className="service-toolbar"><div className="service-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar orden, equipo, IMEI o cliente…"/></div><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} aria-label="Filtrar por estado"><option value="all">Todos los estados</option>{statuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
    {loading?<div className="empty">Cargando órdenes…</div>:filtered.length===0?<div className="empty service-empty"><Wrench size={22}/><b>No hay órdenes para mostrar</b><span>Registra una nueva orden o cambia los filtros.</span></div>:<div className="service-order-list">{filtered.map(o=><button type="button" key={o.id} className={"service-order-row "+(selected===o.id?"selected":"")} onClick={()=>void openOrder(o)}><span className="service-order-icon"><Smartphone size={17}/></span><span className="service-order-main"><b>#{o.order_number} · {o.device_name}</b><small>{o.customers?.full_name??"Sin cliente"}{o.serial_number?" · "+o.serial_number:""}</small><small>{dateFmt(o.received_at)}</small></span><span className={"service-status status-"+o.status}>{statusLabel(o.status)}</span></button>)}</div>}
   </section>
   <section className="panel service-detail-panel">{!active?<div className="service-detail-empty"><ClipboardCheck size={30}/><h2>¿Qué necesitas hacer?</h2><p>1. Selecciona una orden de la lista. 2. Actualiza el estado y el diagnóstico. 3. Registra repuestos, fotos y abonos según avances.</p><div className="service-quick-tip"><MousePointerClick size={16}/><span><b>Consejo:</b> usa el buscador por cliente, equipo o IMEI y el filtro de estado para encontrarla rápido.</span></div></div>:<div className="service-detail">
    <div className="service-detail-head"><div><span className="eyebrow">ORDEN #{active.order_number}</span><h2>{active.device_name}</h2><p>{active.customers?.full_name??"Sin cliente asociado"}{active.customers?.phone?" · "+active.customers.phone:""}</p></div><div className="service-detail-actions"><button className="button secondary service-print-button" type="button" onClick={printReceipt}><ReceiptText size={14}/> Imprimir comprobante</button><button className="button danger service-delete-button" type="button" onClick={()=>void deleteOrder()} disabled={saving} title="Eliminar solo si no tiene repuestos, abonos ni evidencias"><Trash2 size={14}/>{saving?"Procesando…":"Eliminar"}</button><button className="icon-button" type="button" onClick={closeDetail} aria-label="Cerrar detalle"><X size={15}/></button></div></div>
    <div className="service-device-meta"><span><Smartphone size={14}/>{active.serial_number||"Sin IMEI / serial"}</span><span><CalendarClock size={14}/>Recibido: {dateFmt(active.received_at)}</span><span><Clock3 size={14}/>Prometido: {dateFmt(active.promised_at)}</span></div>
    <div className="service-subsection"><div className="service-subsection-head"><h3>Clave / patrón de desbloqueo</h3><span>{accessCode?"Guardada":"Sin clave registrada"}</span></div>{editingAccessCode?<form className="service-inline-form" onSubmit={e=>{e.preventDefault();void saveAccessCode()}}><div className="field"><label>{accessCode?"Nueva clave / patrón":"Registrar clave / patrón"}</label><input type="password" autoComplete="off" maxLength={120} value={accessCodeDraft} onChange={e=>setAccessCodeDraft(e.target.value)} placeholder="Escribe la clave o patrón"/></div><button type="submit" className="button" disabled={saving}><Save size={13}/>{saving?"Guardando…":"Guardar clave"}</button><button type="button" className="button secondary" onClick={()=>{setEditingAccessCode(false);setAccessCodeDraft(accessCode)}}>Cancelar</button></form>:<div className="service-inline-form">{accessCode&&<><input readOnly type={showAccessCode?"text":"password"} value={accessCode} aria-label="Clave de desbloqueo"/><button type="button" className="button secondary" onClick={()=>setShowAccessCode(v=>!v)}>{showAccessCode?"Ocultar clave":"Mostrar clave"}</button></>}<button type="button" className="button secondary" onClick={()=>{setAccessCodeDraft(accessCode);setEditingAccessCode(true)}}>{accessCode?"Editar clave":"Agregar clave"}</button></div>}<small>Visible únicamente para personal con permisos de acceso a credenciales.</small></div>
    <div className="service-status-control"><label>Estado de la orden</label><select value={active.status} disabled={saving||active.status==="cancelled"} onChange={e=>void changeStatus(e.target.value as Status)}>{statuses.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></div>
    {active.status!=="cancelled"&&<div className="service-workflow"><div className="service-workflow-title"><div><span className="eyebrow">SIGUIENTE PASO</span><h3>{nextStep[active.status]?.label??"Orden finalizada"}</h3><p>{nextStep[active.status]?.hint??"Esta orden ya no requiere acciones."}</p></div><span className="service-workflow-count">{workflowStatuses.indexOf(active.status)+1}/{workflowStatuses.length}</span></div><div className="service-workflow-rail">{workflowStatuses.map((st,i)=><span key={st} className={i<=workflowStatuses.indexOf(active.status)?"done":""} title={statusLabel(st)} />)}</div>{nextStep[active.status]&&<button type="button" className="button service-next-step" disabled={saving} onClick={()=>void changeStatus(nextStep[active.status]!.status)}><CheckCircle2 size={15}/>{nextStep[active.status]!.label}</button>}</div>}
    <div className="service-intake-summary"><div className="service-subsection-head"><h3><ClipboardCheck size={15}/> Recepción del equipo</h3><span>{active.intake_checklist?Object.values(active.intake_checklist).filter(Boolean).length+"/"+checklistLabels.length+" comprobaciones":"Sin checklist"}</span></div><p><b>Estado físico:</b> {active.device_condition||"No registrado"}</p><p><b>Accesorios:</b> {active.accessories||"No registrados"}</p><div className="service-intake-summary-grid">{checklistLabels.map(item=><span key={item.key} className={active.intake_checklist?.[item.key]?"checked":""}><CheckCircle2 size={13}/>{item.label}</span>)}</div></div>
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
  {showReceipt&&active&&<section className="service-print-receipt" aria-label="Comprobante de recepción"><div className="service-receipt-brand"><div className="service-receipt-mark">D</div><div><h1>DARKPHONE TECH</h1><p>Comprobante de recepción de equipo</p></div></div><div className="service-receipt-number"><span>ORDEN DE SERVICIO</span><strong>#{active.order_number}</strong><small>Fecha: {dateFmt(active.received_at)}</small></div><div className="service-receipt-grid"><div><small>Cliente</small><strong>{active.customers?.full_name??"Sin cliente asociado"}</strong><span>{active.customers?.phone??"Sin teléfono registrado"}</span></div><div><small>Equipo</small><strong>{active.device_name}</strong><span>IMEI / serial: {active.serial_number||"No registrado"}</span></div><div><small>Estado actual</small><strong>{statusLabel(active.status)}</strong><span>Fecha prometida: {dateFmt(active.promised_at)}</span></div><div><small>Presupuesto estimado</small><strong>{fmt(Number(active.estimated_cost))}</strong><span>Costo final: {active.final_cost===null?"Pendiente":fmt(Number(active.final_cost))}</span></div></div><div className="service-receipt-section"><h2>Falla reportada</h2><p>{active.reported_fault}</p></div><div className="service-receipt-section"><h2>Estado físico al recibir</h2><p>{active.device_condition||"No registrado"}</p><h2>Accesorios recibidos</h2><p>{active.accessories||"No registrados"}</p></div><div className="service-receipt-section"><h2>Checklist de recepción</h2><div className="service-receipt-checks">{checklistLabels.map(item=><span key={item.key}>{active.intake_checklist?.[item.key]?"☑":"☐"} {item.label}</span>)}</div></div><div className="service-receipt-section"><h2>Condiciones de recepción</h2><p>Este comprobante registra el estado y los accesorios declarados al recibir el equipo. El diagnóstico y el costo final pueden cambiar tras las pruebas técnicas y deberán informarse al cliente antes de realizar trabajos adicionales.</p></div><div className="service-receipt-signatures"><div>Firma del cliente</div><div>Recibido por</div></div><footer>Conserva este comprobante para consultar el estado de tu reparación. Orden #{active.order_number}.</footer><button type="button" className="button service-receipt-print-action" onClick={()=>window.print()}>Imprimir / Guardar PDF</button></section>}
 </div>;
