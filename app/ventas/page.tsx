"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Search,ShoppingCart,Plus,Minus,Trash2,RefreshCw,UserRound,CreditCard,Banknote,CheckCircle2,Clock3,ReceiptText } from "lucide-react";
import { supabase } from "@/lib/supabase";
type Product={id:string;name:string;brand:string|null;model:string|null;sku:string|null;category:string|null;cost_price:number;selling_price:number;stock_quantity:number;has_imei:boolean;active:boolean};
type Customer={id:string;full_name:string;phone:string|null};
type Sale={id:string;sale_number:number;status:string;subtotal:number;discount:number;total:number;created_at:string;customers?:{full_name:string}|null};
type CartLine={product:Product;quantity:number;serial_ids:string[]};
type PayMethod="cash"|"debit_card"|"credit_card"|"bank_transfer"|"nequi"|"daviplata"|"other";
type Payment={method:PayMethod;amount:string;reference:string};
const fmt=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);
const methods:{value:PayMethod;label:string}[]=[{value:"cash",label:"Efectivo"},{value:"debit_card",label:"Tarjeta débito"},{value:"credit_card",label:"Tarjeta crédito"},{value:"bank_transfer",label:"Transferencia"},{value:"nequi",label:"Nequi"},{value:"daviplata",label:"Daviplata"},{value:"other",label:"Otro"}];
export default function SalesPage(){
 const [products,setProducts]=useState<Product[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[sales,setSales]=useState<Sale[]>([]);
 const [cart,setCart]=useState<CartLine[]>([]),[query,setQuery]=useState(""),[customerId,setCustomerId]=useState(""),[discount,setDiscount]=useState("0"),[notes,setNotes]=useState("");
 const [payments,setPayments]=useState<Payment[]>([{method:"cash",amount:"",reference:""}]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[success,setSuccess]=useState<{sale_number:number;total:number;balance:number}|null>(null);
 const load=useCallback(async()=>{
  if(!supabase){setMessage("Falta configurar Supabase para consultar productos y guardar ventas.");setLoading(false);return}
  setLoading(true);
  const [p,c,s]=await Promise.all([
   supabase.from("products").select("id,name,brand,model,sku,category,cost_price,selling_price,stock_quantity,has_imei,active").eq("active",true).order("name").limit(500),
   supabase.from("customers").select("id,full_name,phone").order("full_name").limit(500),
   supabase.from("sales").select("id,sale_number,status,subtotal,discount,total,created_at,customers(full_name)").order("created_at",{ascending:false}).limit(30)
  ]);
  if(p.error)setMessage("No se pudo cargar el inventario: "+p.error.message);else setProducts((p.data??[]) as Product[]);
  if(c.error)setMessage("No se pudieron cargar los clientes: "+c.error.message);else setCustomers((c.data??[]) as Customer[]);
  if(s.error)setMessage("No se pudo cargar el historial: "+s.error.message);else setSales((s.data??[]) as unknown as Sale[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const visible=useMemo(()=>products.filter(p=>[p.name,p.brand,p.model,p.sku,p.category].some(v=>v?.toLowerCase().includes(query.toLowerCase()))),[products,query]);
 const subtotal=cart.reduce((sum,l)=>sum+l.product.selling_price*l.quantity,0),discountValue=Math.max(0,Number(discount)||0),total=Math.max(0,subtotal-discountValue),paid=payments.reduce((s,p)=>s+Math.max(0,Number(p.amount)||0),0),balance=Math.max(0,total-paid);
 function add(p:Product){setMessage("");setSuccess(null);setCart(old=>{const found=old.find(l=>l.product.id===p.id);if(found){if(found.quantity>=p.stock_quantity)return old;return old.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l)}if(p.stock_quantity<1){setMessage("Este producto no tiene existencias disponibles.");return old}return [...old,{product:p,quantity:1,serial_ids:[]}]})}
 function quantity(id:string,delta:number){setCart(old=>old.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(l.product.stock_quantity,l.quantity+delta))}:l))}
 function remove(id:string){setCart(old=>old.filter(l=>l.product.id!==id))}
 function changePayment(index:number,patch:Partial<Payment>){setPayments(old=>old.map((p,i)=>i===index?{...p,...patch}:p))}
 async function submit(e:React.FormEvent){
  e.preventDefault();setMessage("");setSuccess(null);
  if(!supabase){setMessage("Supabase no está configurado.");return}
  if(!cart.length){setMessage("Agrega al menos un producto.");return}
  if(discountValue>subtotal){setMessage("El descuento no puede superar el subtotal.");return}
  if(paid>total){setMessage("Los pagos superan el total. Ajusta los valores.");return}
  if(total<=0||Math.abs(paid-total)>0.5){setMessage("Para cerrar la venta, los medios de pago deben cubrir exactamente el total. Los pagos a crédito se habilitarán cuando esté listo el módulo de cuentas por cobrar.");return}
  if(cart.some(l=>l.quantity>l.product.stock_quantity)){setMessage("El inventario cambió. Actualiza los datos antes de continuar.");return}
  setSaving(true);
  const payloadItems=cart.map(l=>({product_id:l.product.id,quantity:l.quantity,serial_ids:l.serial_ids}));
  const payloadPayments=payments.filter(p=>Number(p.amount)>0).map(p=>({method:p.method,amount:Number(p.amount),reference:p.reference.trim()||null}));
  const {data,error}=await supabase.rpc("create_sale",{p_customer_id:customerId||null,p_discount:discountValue,p_notes:notes.trim()||null,p_items:payloadItems,p_payments:payloadPayments});
  setSaving(false);
  if(error){setMessage(error.message.includes("Could not find the function")||error.message.includes("schema cache")?"La pantalla está lista, pero falta instalar la función transaccional create_sale en Supabase. No se guardó ninguna venta.":"No se pudo registrar la venta: "+error.message);return}
  const result=data as {sale_number:number;total:number;balance:number};
  setSuccess({sale_number:result.sale_number,total:Number(result.total),balance:Number(result.balance)});
  setCart([]);setCustomerId("");setDiscount("0");setNotes("");setPayments([{method:"cash",amount:"",reference:""}]);await load();
 }
 return <div className="content sales-page">
  <div className="page-head"><div><div className="eyebrow">PUNTO DE VENTA</div><h1>Ventas</h1><p>Registra productos, aplica descuentos y recibe pagos con trazabilidad.</p></div><button className="button secondary" type="button" onClick={()=>void load()}><RefreshCw size={14}/> Actualizar</button></div>
  {message&&<div className="notice" role="status">{message}</div>}
  {success&&<div className="sales-success"><CheckCircle2 size={20}/><div><b>Venta #{success.sale_number} registrada</b><span>Total {fmt(success.total)} · {success.balance>0?"Saldo pendiente "+fmt(success.balance):"Pagada en su totalidad"}</span></div><button type="button" className="button secondary" onClick={()=>setSuccess(null)}>Continuar</button></div>}
  <div className="grid stats sales-stats"><article className="stat"><label>Productos disponibles</label><strong>{products.length}</strong><small>Catálogo activo</small></article><article className="stat"><label>Ventas recientes</label><strong>{sales.length}</strong><small>Últimos registros cargados</small></article><article className="stat"><label>Unidades en carrito</label><strong>{cart.reduce((s,l)=>s+l.quantity,0)}</strong><small>{cart.length} referencias seleccionadas</small></article><article className="stat"><label>Total de la venta</label><strong>{fmt(total)}</strong><small>{balance>0?"Pendiente "+fmt(balance):"Listo para cobrar"}</small></article></div>
  <div className="sales-layout">
   <section className="panel sales-catalog"><div className="panel-head"><div><h2>Seleccionar productos</h2><p>{visible.length} artículos disponibles en catálogo</p></div><ShoppingCart size={19}/></div><div className="toolbar"><Search size={16}/><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar nombre, marca, modelo o SKU…"/></div>
    {loading?<div className="empty">Cargando catálogo…</div>:visible.length===0?<div className="empty">No hay productos para mostrar. Revisa el inventario o cambia la búsqueda.</div>:<div className="sales-product-list">{visible.map(p=><article className="sales-product" key={p.id}><div className="sales-product-icon"><ReceiptText size={18}/></div><div className="sales-product-info"><b>{p.name}</b><small>{[p.brand,p.model,p.sku].filter(Boolean).join(" · ")||p.category||"Producto"}</small><strong>{fmt(p.selling_price)}</strong><small className={p.stock_quantity<1?"danger":"muted"}>{p.stock_quantity} disponibles{p.has_imei?" · venta por IMEI pendiente de activar":""}</small></div><button type="button" className="icon-button" aria-label={"Agregar "+p.name} title="Agregar al carrito" disabled={p.stock_quantity<1||p.has_imei||cart.find(l=>l.product.id===p.id)?.quantity===p.stock_quantity} onClick={()=>add(p)}><Plus size={16}/></button></article>)}</div>}
   </section>
   <section className="panel sales-checkout"><div className="panel-head"><div><h2>Resumen de venta</h2><p>Confirma los artículos y los datos de cobro.</p></div><ShoppingCart size={19}/></div>
    <form onSubmit={submit}>
     <div className="field"><label><UserRound size={13} style={{display:"inline",verticalAlign:"-2px"}}/> Cliente (opcional)</label><select value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Venta de mostrador / sin cliente</option>{customers.map(c=><option value={c.id} key={c.id}>{c.full_name}{c.phone?" · "+c.phone:""}</option>)}</select></div>
     <div className="sales-cart">{cart.length===0?<div className="empty">Agrega productos desde el catálogo para iniciar.</div>:cart.map(l=><div className="sales-cart-line" key={l.product.id}><div className="sales-cart-name"><b>{l.product.name}</b><small>{fmt(l.product.selling_price)} c/u</small></div><div className="sales-qty"><button type="button" className="icon-button" aria-label="Disminuir" onClick={()=>quantity(l.product.id,-1)}><Minus size={12}/></button><b>{l.quantity}</b><button type="button" className="icon-button" aria-label="Aumentar" disabled={l.quantity>=l.product.stock_quantity} onClick={()=>quantity(l.product.id,1)}><Plus size={12}/></button><button type="button" className="icon-button delete-button" aria-label="Quitar" onClick={()=>remove(l.product.id)}><Trash2 size={13}/></button></div><strong className="sales-line-total">{fmt(l.product.selling_price*l.quantity)}</strong></div>)}</div>
     <div className="field"><label>Descuento total (COP)</label><input type="number" min="0" max={subtotal} step="1" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
     <div className="sales-totals"><div><span>Subtotal</span><b>{fmt(subtotal)}</b></div><div><span>Descuento</span><b>− {fmt(discountValue)}</b></div><div className="sales-grand-total"><span>Total</span><strong>{fmt(total)}</strong></div></div>
     <div className="sales-pay-head"><div><h3>Medios de pago</h3><p>Puedes dividir el pago entre varios medios.</p></div><button type="button" className="button secondary" onClick={()=>setPayments(p=>[...p,{method:"cash",amount:"",reference:""}])}><Plus size={13}/> Añadir</button></div>
     {payments.map((p,i)=><div className="sales-payment" key={i}><div className="field"><label>Medio</label><select value={p.method} onChange={e=>changePayment(i,{method:e.target.value as PayMethod})}>{methods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></div><div className="field"><label>Valor (COP)</label><input type="number" min="0" step="1" value={p.amount} onChange={e=>changePayment(i,{amount:e.target.value})} placeholder="0"/></div><div className="field sales-reference"><label>Referencia (opcional)</label><input value={p.reference} onChange={e=>changePayment(i,{reference:e.target.value})} placeholder="N.º operación"/></div>{payments.length>1&&<button type="button" className="icon-button delete-button" aria-label="Quitar medio de pago" onClick={()=>setPayments(old=>old.filter((_,j)=>j!==i))}><Trash2 size={14}/></button>}</div>)}
     <div className="sales-paid"><span>Recibido</span><b>{fmt(paid)}</b><span>{balance>0?"Pendiente":"Saldo"}</span><b className={balance>0?"negative":"success"}>{fmt(balance)}</b></div>
     <div className="field"><label>Notas (opcional)</label><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observaciones de la venta…"/></div>
     <button type="submit" className="button sales-submit" disabled={saving||loading||cart.length===0||total<=0||paid>total||Math.abs(paid-total)>0.5}><Banknote size={17}/>{saving?"Registrando venta…":"Confirmar venta"}</button>
     <p className="sales-footnote"><CreditCard size={13}/> El servidor debe validar la venta y actualizar existencias y caja de forma atómica.</p>
    </form>
   </section>
  </div>
  <section className="panel sales-history"><div className="panel-head"><div><h2>Ventas recientes</h2><p>Últimas 30 operaciones registradas</p></div><Clock3 size={18}/></div>{loading?<div className="empty">Cargando ventas…</div>:sales.length===0?<div className="empty">Aún no hay ventas registradas.</div>:<div className="table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td><b>#{s.sale_number}</b></td><td>{new Date(s.created_at).toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"})}</td><td>{s.customers?.full_name??"Mostrador"}</td><td><span className="pill">{s.status==="completed"?"Pagada":s.status==="pending"?"Pendiente":s.status}</span></td><td><b>{fmt(Number(s.total))}</b></td></tr>)}</tbody></table></div>}</section>
 </div>
}
