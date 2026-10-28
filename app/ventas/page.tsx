"use client";
import { useCallback,useEffect,useMemo,useState } from "react";
import { Search,ShoppingCart,Plus,Minus,Trash2,RefreshCw,UserRound,CreditCard,Banknote,CheckCircle2,Clock3,ReceiptText,UserPlus,X,SlidersHorizontal,RotateCcw,PackageCheck,Smartphone,Printer,Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
const PRODUCT_CATEGORIES=["Accesorios","Audio","Baterías","Cocos","Celulares","Computadores","Displays","Pantallas","Repuestos","Tablets","Tapas","Tapas completas","Tapas lisas","Otros"];
type Product={id:string;name:string;brand:string|null;model:string|null;sku:string|null;category:string|null;cost_price:number;selling_price:number;stock_quantity:number;has_imei:boolean;active:boolean};
type Customer={id:string;full_name:string;phone:string|null};
type Serial={id:string;product_id:string;serial_number:string;status:string};
type Sale={id:string;sale_number:number;status:string;subtotal:number;discount:number;total:number;created_at:string;customers?:{full_name:string}|null};
type CartLine={product:Product;quantity:number;serial_ids:string[]};
type PayMethod="cash"|"debit_card"|"credit_card"|"bank_transfer"|"nequi"|"daviplata"|"other";
type Payment={method:PayMethod;amount:string;reference:string};
type ReceiptData={sale_number:number;created_at:string;customer_name:string;customer_phone:string|null;items:{name:string;sku:string|null;quantity:number;unit_price:number;line_total:number;serial_number?:string|null}[];payments:{method:string;amount:number;reference:string|null}[];subtotal:number;discount:number;total:number;notes:string;status:string};
const paymentLabel=(method:string)=>methods.find(m=>m.value===method)?.label??method;
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]??char));
const fmt=(n:number)=>new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n||0);
const normalize=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
const productModel=(p:Product)=>{if(p.model?.trim())return p.model.trim();const match=p.name.match(/iphone\s+(.+?)(?:\s+-\s+[^-]+)?$/i);return match?.[1]?.trim()??""};
const productColor=(p:Product)=>{const match=p.name.match(/\s+-\s+([^-]+)$/);return match?.[1]?.trim()??""};
const methods:{value:PayMethod;label:string}[]=[{value:"cash",label:"Efectivo"},{value:"debit_card",label:"Tarjeta débito"},{value:"credit_card",label:"Tarjeta crédito"},{value:"bank_transfer",label:"Transferencia"},{value:"nequi",label:"Nequi"},{value:"daviplata",label:"Daviplata"},{value:"other",label:"Otro"}];
export default function SalesPage(){
 const [products,setProducts]=useState<Product[]>([]),[customers,setCustomers]=useState<Customer[]>([]),[sales,setSales]=useState<Sale[]>([]),[serials,setSerials]=useState<Serial[]>([]);\n const [activeView,setActiveView]=useState<"create"|"history">("create");
 const [cart,setCart]=useState<CartLine[]>([]),[query,setQuery]=useState(""),[categoryFilter,setCategoryFilter]=useState("Todas"),[modelFilter,setModelFilter]=useState("Todos"),[colorFilter,setColorFilter]=useState("Todos"),[availableOnly,setAvailableOnly]=useState(false),[imeiOnly,setImeiOnly]=useState(false),[customerId,setCustomerId]=useState(""),[customerSearch,setCustomerSearch]=useState(""),[discount,setDiscount]=useState("0"),[notes,setNotes]=useState("");
 const [payments,setPayments]=useState<Payment[]>([{method:"cash",amount:"",reference:""}]);
 const [showNewCustomer,setShowNewCustomer]=useState(false),[customerSaving,setCustomerSaving]=useState(false);
 const [newCustomer,setNewCustomer]=useState({full_name:"",phone:"",email:"",document_number:""});
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[message,setMessage]=useState(""),[success,setSuccess]=useState<{sale_number:number;total:number;balance:number}|null>(null),[receipt,setReceipt]=useState<ReceiptData|null>(null),[receiptLoading,setReceiptLoading]=useState(false);
 const load=useCallback(async()=>{
  if(!supabase){setMessage("Falta configurar Supabase para consultar productos y guardar ventas.");setLoading(false);return}
  setLoading(true);
  const [p,c,s,ser]=await Promise.all([
   supabase.from("products").select("id,name,brand,model,sku,category,cost_price,selling_price,stock_quantity,has_imei,active").eq("active",true).order("name").limit(500),
   supabase.from("customers").select("id,full_name,phone").order("full_name").limit(500),
   supabase.from("sales").select("id,sale_number,status,subtotal,discount,total,created_at,customers(full_name)").order("created_at",{ascending:false}).limit(30),
   supabase.from("product_serials").select("id,product_id,serial_number,status").eq("status","available").order("serial_number").limit(2000)
  ]);
  if(p.error)setMessage("No se pudo cargar el inventario: "+p.error.message);else setProducts((p.data??[]) as Product[]);
  if(c.error)setMessage("No se pudieron cargar los clientes: "+c.error.message);else setCustomers((c.data??[]) as Customer[]);
  if(s.error)setMessage("No se pudo cargar el historial: "+s.error.message);else setSales((s.data??[]) as unknown as Sale[]);
  if(ser.error)setMessage("No se pudieron cargar IMEI/seriales: "+ser.error.message);else setSerials((ser.data??[]) as Serial[]);
  setLoading(false);
 },[]);
 useEffect(()=>{void load()},[load]);
 const categories=useMemo(()=>Array.from(new Set([...PRODUCT_CATEGORIES,...products.map(p=>p.category?.trim()).filter((v):v is string=>Boolean(v))])).sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[products]);
 const models=useMemo(()=>Array.from(new Set(products.map(productModel).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es",{numeric:true,sensitivity:"base"})),[products]);
 const colors=useMemo(()=>Array.from(new Set(products.map(productColor).filter(Boolean))).sort((a,b)=>a.localeCompare(b,"es",{sensitivity:"base"})),[products]);
 const visible=useMemo(()=>{const tokens=normalize(query).split(/\s+/).filter(Boolean);return products.filter(p=>{const text=normalize([p.name,p.brand,p.model,p.sku,p.category,productModel(p),productColor(p)].filter(Boolean).join(" "));return tokens.every(token=>text.includes(token))&&(categoryFilter==="Todas"||p.category===categoryFilter)&&(modelFilter==="Todos"||normalize(productModel(p))===normalize(modelFilter))&&(colorFilter==="Todos"||normalize(productColor(p))===normalize(colorFilter))&&(!availableOnly||p.stock_quantity>0)&&(!imeiOnly||p.has_imei)});},[products,query,categoryFilter,modelFilter,colorFilter,availableOnly,imeiOnly]);
 const activeFilters=Number(categoryFilter!=="Todas")+Number(modelFilter!=="Todos")+Number(colorFilter!=="Todos")+Number(availableOnly)+Number(imeiOnly);
 function clearFilters(){setQuery("");setCategoryFilter("Todas");setModelFilter("Todos");setColorFilter("Todos");setAvailableOnly(false);setImeiOnly(false)}
 const subtotal=cart.reduce((sum,l)=>sum+l.product.selling_price*l.quantity,0),discountValue=Math.max(0,Number(discount)||0),total=Math.max(0,subtotal-discountValue),paid=payments.reduce((s,p)=>s+Math.max(0,Number(p.amount)||0),0),balance=Math.max(0,total-paid);
 function add(p:Product){setMessage("");setSuccess(null);setCart(old=>{const found=old.find(l=>l.product.id===p.id);if(found){if(found.quantity>=p.stock_quantity)return old;return old.map(l=>l.product.id===p.id?{...l,quantity:l.quantity+1}:l)}if(p.stock_quantity<1){setMessage("Este producto no tiene existencias disponibles.");return old}return [...old,{product:p,quantity:1,serial_ids:[]}]})}
 function quantity(id:string,delta:number){setCart(old=>old.map(l=>l.product.id===id?{...l,quantity:Math.max(1,Math.min(l.product.stock_quantity,l.quantity+delta))}:l))}
 function remove(id:string){setCart(old=>old.filter(l=>l.product.id!==id))}
 function changePayment(index:number,patch:Partial<Payment>){setPayments(old=>old.map((p,i)=>i===index?{...p,...patch}:p))}
 async function createCustomer(){
  if(!supabase)return;setCustomerSaving(true);setMessage("");
  const payload={full_name:newCustomer.full_name.trim(),phone:newCustomer.phone.trim()||null,email:newCustomer.email.trim()||null,document_number:newCustomer.document_number.trim()||null};
  let existing:Customer|undefined;
  if(payload.document_number){
   const {data,error}=await supabase.from("customers").select("id,full_name,phone").eq("document_number",payload.document_number).limit(1);
   if(error){setCustomerSaving(false);setMessage("No se pudo comprobar si el documento ya existe: "+error.message);return}
   existing=(data??[])[0] as Customer|undefined;
  }
  if(!existing&&payload.phone){
   const {data,error}=await supabase.from("customers").select("id,full_name,phone").eq("phone",payload.phone).limit(1);
   if(error){setCustomerSaving(false);setMessage("No se pudo comprobar si el teléfono ya existe: "+error.message);return}
   existing=(data??[])[0] as Customer|undefined;
  }
  if(!existing&&payload.email){
   const {data,error}=await supabase.from("customers").select("id,full_name,phone").ilike("email",payload.email).limit(1);
   if(error){setCustomerSaving(false);setMessage("No se pudo comprobar si el correo ya existe: "+error.message);return}
   existing=(data??[])[0] as Customer|undefined;
  }
  if(existing){setCustomerSaving(false);setCustomerId(existing.id);setCustomerSearch("");setShowNewCustomer(false);setNewCustomer({full_name:"",phone:"",email:"",document_number:""});setMessage("Encontré un cliente con el mismo documento, teléfono o correo: "+existing.full_name+". Lo seleccioné para esta venta; revisa sus datos en Clientes.");return}
  const {data,error}=await supabase.from("customers").insert(payload).select("id,full_name,phone").single();
  setCustomerSaving(false);
  if(error){setMessage("No se pudo registrar el cliente: "+error.message);return}
  const customer=data as Customer;setCustomers(old=>[...old,customer].sort((a,b)=>a.full_name.localeCompare(b.full_name,"es")));
  setCustomerId(customer.id);setCustomerSearch("");setNewCustomer({full_name:"",phone:"",email:"",document_number:""});setShowNewCustomer(false);
  setMessage("Cliente registrado y asociado a esta venta.");
 }
 function printReceipt(data:ReceiptData){
  const printWindow=window.open("","_blank","width=420,height=720");
  if(!printWindow){setMessage("El navegador bloqueó la ventana del ticket. Permite las ventanas emergentes para imprimir.");return}
  const rows=data.items.map(item=>`<tr><td><b>${escapeHtml(item.name)}</b>${item.sku?`<small>SKU: ${escapeHtml(item.sku)}</small>`:""}${item.serial_number?`<small>IMEI/Serial: ${escapeHtml(item.serial_number)}</small>`:""}<small class="qty">${item.quantity} × ${fmt(item.unit_price)}</small></td><td class="num">${fmt(item.line_total)}</td></tr>`).join("");
  const paymentsHtml=data.payments.map(p=>`<div class="line"><span>${escapeHtml(paymentLabel(p.method))}${p.reference?`<small class="ref">${escapeHtml(p.reference)}</small>`:""}</span><b>${fmt(p.amount)}</b></div>`).join("");
  printWindow.document.open();
  printWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Comprobante Darkphone</title><style>
  @page{size:80mm auto;margin:0}
  *{box-sizing:border-box}
  body{font:12px/1.45 Arial,Helvetica,sans-serif;color:#151515;margin:0 auto;max-width:72mm;background:#fff;padding:4mm}
  .brand{text-align:center;padding:4px 0 13px}
  .logo{display:block;width:46px;height:46px;object-fit:contain;border-radius:12px;margin:0 auto 8px}
  h1{font-size:22px;line-height:1;margin:0 0 6px;letter-spacing:1.8px;font-weight:800}
  .subtitle{font-size:11px;color:#555;margin:0;letter-spacing:.3px}
  .rule{border:0;border-top:1px dashed #aaa;margin:0}
  .meta{padding:10px 0}
  .meta div,.line{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin:5px 0}
  .meta span:first-child,.line>span{color:#555}
  .meta b,.meta span:last-child{text-align:right;overflow-wrap:anywhere}
  table{width:100%;border-collapse:collapse;margin:0}
  td{padding:9px 0;vertical-align:top;border-bottom:1px solid #e6e6e6}
  td:first-child{width:68%;padding-right:8px}
  td b{display:block;font-size:12px;line-height:1.35;overflow-wrap:anywhere}
  td small{display:block;color:#666;font-size:10px;line-height:1.45;overflow-wrap:anywhere}
  td .qty{margin-top:3px;color:#333}
  .num{text-align:right;white-space:nowrap;font-weight:700;font-size:12px}
  .totals{padding:9px 0 8px}
  .line{margin:5px 0}
  .line>span{min-width:0;overflow-wrap:anywhere}
  .ref{display:block;font-size:10px;color:#777;margin-top:2px}
  .grand{border-top:1px solid #222;border-bottom:1px solid #222;padding:10px 0;margin:10px 0 9px;align-items:center}
  .grand span{font-size:15px;font-weight:800;letter-spacing:.6px;color:#111}
  .grand strong{font-size:19px;white-space:nowrap}
  .payments-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;font-weight:700;margin:10px 0 6px}
  .notes{border-top:1px dashed #aaa;margin-top:8px;padding-top:9px;overflow-wrap:anywhere}
  .notes b{font-size:10px;text-transform:uppercase;letter-spacing:.5px}
  .notes p{margin:4px 0 0}
  footer{text-align:center;border-top:1px dashed #aaa;margin-top:10px;padding:12px 0 3px}
  footer .thanks{font-size:12px;font-weight:700;margin:0 0 4px}
  footer .small{font-size:10px;color:#666;margin:2px 0}
  @media screen{body{padding:12px}}
  </style></head><body>
  <header class="brand"><img class="logo" src="${window.location.origin}/darkphone-mark.svg" alt="Logo Darkphone" onerror="this.style.display='none'"><h1>DARKPHONE</h1><p class="subtitle">COMPROBANTE DE VENTA</p></header>
  <hr class="rule">
  <section class="meta"><div><span>Fecha</span><span>${escapeHtml(new Date(data.created_at).toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"}))}</span></div><div><span>Cliente</span><span>${escapeHtml(data.customer_name||"Mostrador")}</span></div>${data.customer_phone?`<div><span>Teléfono</span><span>${escapeHtml(data.customer_phone)}</span></div>`:""}</section>
  <hr class="rule"><table><tbody>${rows}</tbody></table>
  <section class="totals"><div class="line"><span>Subtotal</span><b>${fmt(data.subtotal)}</b></div><div class="line"><span>Descuento</span><b>− ${fmt(data.discount)}</b></div><div class="line grand"><span>TOTAL</span><strong>${fmt(data.total)}</strong></div><p class="payments-title">Medios de pago</p>${paymentsHtml}</section>
  ${data.notes?`<section class="notes"><b>Observaciones</b><p>${escapeHtml(data.notes)}</p></section>`:""}
  <footer><p class="thanks">¡Gracias por tu compra!</p><p class="small">Conserva este comprobante</p><p class="small">DARKPHONE</p></footer>
  <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),350));window.addEventListener("afterprint",()=>window.close());</script></body></html>`);
  printWindow.document.close();
}
async function viewSale(sale:Sale){
  if(!supabase)return;
  setReceiptLoading(true);setMessage("");
  const [itemsResult,paymentsResult]=await Promise.all([
    supabase.from("sale_items").select("quantity,unit_price,line_total,serial_id,products(name,sku)").eq("sale_id",sale.id),
    supabase.from("sale_payments").select("method,amount,reference").eq("sale_id",sale.id)
  ]);
  if(itemsResult.error||paymentsResult.error){setMessage("No se pudo abrir el detalle de la venta: "+(itemsResult.error?.message??paymentsResult.error?.message));setReceiptLoading(false);return}
  const rawItems=(itemsResult.data??[]) as unknown as {quantity:number;unit_price:number;line_total:number;serial_id:string|null;products:{name:string;sku:string|null}|null}[];
  const serialIds=rawItems.map(item=>item.serial_id).filter((id):id is string=>Boolean(id));
  let serialMap=new Map<string,string>();
  if(serialIds.length){const serialResult=await supabase.from("product_serials").select("id,serial_number").in("id",serialIds);if(!serialResult.error)serialMap=new Map((serialResult.data??[]).map((x:{id:string;serial_number:string})=>[x.id,x.serial_number]))}
  const data:ReceiptData={sale_number:sale.sale_number,created_at:sale.created_at,customer_name:sale.customers?.full_name??"Mostrador",customer_phone:null,items:rawItems.map(item=>({name:item.products?.name??"Producto",sku:item.products?.sku??null,quantity:Number(item.quantity),unit_price:Number(item.unit_price),line_total:Number(item.line_total),serial_number:item.serial_id?serialMap.get(item.serial_id)??null:null})),payments:(paymentsResult.data??[]).map((p:{method:string;amount:number;reference:string|null})=>({...p,amount:Number(p.amount)})),subtotal:Number(sale.subtotal),discount:Number(sale.discount),total:Number(sale.total),notes:"",status:sale.status};
  setReceipt(data);setReceiptLoading(false);
}
async function submit(e:React.FormEvent){
  e.preventDefault();setMessage("");setSuccess(null);
  if(!supabase){setMessage("Supabase no está configurado.");return}
  if(!cart.length){setMessage("Agrega al menos un producto.");return}
  if(discountValue>subtotal){setMessage("El descuento no puede superar el subtotal.");return}
  if(paid>total){setMessage("Los pagos superan el total. Ajusta los valores.");return}
  if(total<=0||Math.abs(paid-total)>0.5){setMessage("Para cerrar la venta, los medios de pago deben cubrir exactamente el total. Los pagos a crédito se habilitarán cuando esté listo el módulo de cuentas por cobrar.");return}
  if(cart.some(l=>l.quantity>l.product.stock_quantity)){setMessage("El inventario cambió. Actualiza los datos antes de continuar.");return}
  if(cart.some(l=>l.product.has_imei&&(l.serial_ids.length!==l.quantity||l.serial_ids.some(id=>!id)||new Set(l.serial_ids).size!==l.quantity))){setMessage("Selecciona un IMEI/serial único para cada unidad de los equipos que lo requieren.");return}
  setSaving(true);
  try {
   const payloadItems=cart.map(l=>({product_id:l.product.id,quantity:l.quantity,serial_ids:l.serial_ids}));
   const payloadPayments=payments.filter(p=>Number(p.amount)>0).map(p=>({method:p.method,amount:Number(p.amount),reference:p.reference.trim()||null}));
   const {data,error}=await supabase.rpc("create_sale",{p_customer_id:customerId||null,p_discount:discountValue,p_notes:notes.trim()||null,p_items:payloadItems,p_payments:payloadPayments});
   if(error){setMessage(error.message.includes("Could not find the function")||error.message.includes("schema cache")?"Falta instalar la función create_sale en Supabase. No se guardó ninguna venta.":"No se pudo registrar la venta: "+error.message);return}
   if(!data||typeof data!=="object"||!("sale_number" in data)){setMessage("Supabase no confirmó el registro de la venta. Verifica el historial antes de volver a intentarlo.");return}
   const result=data as {id:string;sale_number:number;subtotal:number;discount:number;total:number;paid:number;balance:number};
   const customer=customers.find(c=>c.id===customerId);
   const receiptData:ReceiptData={sale_number:result.sale_number,created_at:new Date().toISOString(),customer_name:customer?.full_name??"Mostrador",customer_phone:customer?.phone??null,items:cart.map(line=>({name:line.product.name,sku:line.product.sku,quantity:line.quantity,unit_price:line.product.selling_price,line_total:line.product.selling_price*line.quantity,serial_number:line.serial_ids.map(id=>serials.find(item=>item.id===id)?.serial_number).filter(Boolean).join(", ")||null})),payments:payments.filter(p=>Number(p.amount)>0).map(p=>({method:p.method,amount:Number(p.amount),reference:p.reference.trim()||null})),subtotal:Number(result.subtotal),discount:Number(result.discount),total:Number(result.total),notes:notes.trim(),status:"completed"};
   setReceipt(receiptData);setSuccess({sale_number:result.sale_number,total:Number(result.total),balance:Number(result.balance)});
   setCart([]);setCustomerId("");setDiscount("0");setNotes("");setPayments([{method:"cash",amount:"",reference:""}]);await load();
  } catch (err) {
   const detail=err instanceof Error?err.message:"Error inesperado al comunicarse con Supabase.";
   setMessage("No se pudo completar la venta: "+detail+". Revisa el historial antes de volver a intentarlo para evitar duplicados.");
  } finally {
   setSaving(false);
  }
 }
 return <div className="content sales-page">
  <div className="page-head"><div><div className="eyebrow">PUNTO DE VENTA</div><h1>Ventas</h1><p>Registra productos, aplica descuentos y recibe pagos con trazabilidad.</p></div><div className="sales-head-actions"><button className="button secondary" type="button" onClick={()=>void load()}><RefreshCw size={14}/> Actualizar</button></div></div>\n  <div className="sales-view-switch" role="tablist" aria-label="Secciones de ventas"><button type="button" role="tab" aria-selected={activeView==="create"} className={activeView==="create"?"active":""} onClick={()=>setActiveView("create")}><Plus size={15}/> Crear venta</button><button type="button" role="tab" aria-selected={activeView==="history"} className={activeView==="history"?"active":""} onClick={()=>setActiveView("history")}><Clock3 size={15}/> Historial de ventas <span>{sales.length}</span></button></div>
  {message&&<div className="notice" role="status">{message}</div>}
  {success&&<div className="sales-success"><CheckCircle2 size={20}/><div className="sales-success-copy"><b>Venta #{success.sale_number} registrada</b><span>Total {fmt(success.total)} · {success.balance>0?"Saldo pendiente "+fmt(success.balance):"Pagada en su totalidad"}</span><small>El comprobante está listo para imprimir o guardar como PDF.</small></div><button type="button" className="button" onClick={()=>receipt&&printReceipt(receipt)}><Printer size={14}/> Imprimir ticket</button><button type="button" className="button secondary" onClick={()=>document.getElementById("sales-history")?.scrollIntoView({behavior:"smooth",block:"start"})}>Ver ventas</button><button type="button" className="icon-button" aria-label="Cerrar confirmación" onClick={()=>setSuccess(null)}><X size={14}/></button></div>}
  {activeView==="create"&&<><div className="grid stats sales-stats"><article className="stat"><label>Productos disponibles</label><strong>{products.length}</strong><small>Catálogo activo</small></article><article className="stat"><label>Ventas recientes</label><strong>{sales.length}</strong><small>Últimos registros cargados</small></article><article className="stat"><label>Unidades en carrito</label><strong>{cart.reduce((s,l)=>s+l.quantity,0)}</strong><small>{cart.length} referencias seleccionadas</small></article><article className="stat"><label>Total de la venta</label><strong>{fmt(total)}</strong><small>{balance>0?"Pendiente "+fmt(balance):"Listo para cobrar"}</small></article></div>
  <div className="sales-layout">
   <section className="panel sales-catalog"><div className="panel-head"><div><h2>Seleccionar productos</h2><p>{visible.length} artículos coinciden con tu búsqueda</p></div><ShoppingCart size={19}/></div><div className="toolbar sales-search-toolbar"><Search size={16}/><input className="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Busca producto, SKU, modelo o color…"/>{query&&<button type="button" className="sales-clear-search" onClick={()=>setQuery("")} aria-label="Limpiar búsqueda"><X size={14}/></button>}</div><div className="sales-filter-heading"><span><SlidersHorizontal size={13}/> Filtros rápidos</span><span>{visible.length} de {products.length} productos</span></div><div className="sales-product-filters"><label className="sales-filter-field"><span>Categoría</span><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option value="Todas">Todas las categorías</option>{categories.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="sales-filter-field"><span>Modelo</span><select value={modelFilter} onChange={e=>setModelFilter(e.target.value)}><option value="Todos">Todos los modelos</option>{models.map(v=><option key={v} value={v}>{v}</option>)}</select></label><label className="sales-filter-field"><span>Color</span><select value={colorFilter} onChange={e=>setColorFilter(e.target.value)}><option value="Todos">Todos los colores</option>{colors.map(v=><option key={v} value={v}>{v}</option>)}</select></label><button type="button" className={`sales-filter-toggle ${availableOnly?"active":""}`} aria-pressed={availableOnly} onClick={()=>setAvailableOnly(v=>!v)}><PackageCheck size={13}/> Con stock</button><button type="button" className={`sales-filter-toggle ${imeiOnly?"active":""}`} aria-pressed={imeiOnly} onClick={()=>setImeiOnly(v=>!v)}><Smartphone size={13}/> Con IMEI</button>{activeFilters>0&&<button type="button" className="sales-reset-filters" onClick={clearFilters}><RotateCcw size={12}/> Limpiar ({activeFilters})</button>}</div>
    {loading?<div className="empty">Cargando catálogo…</div>:visible.length===0?<div className="empty">No encontramos productos con esos filtros. Prueba otra búsqueda o limpia los filtros.</div>:<div className="sales-product-list">{visible.map(p=><article className="sales-product" key={p.id}><div className="sales-product-icon"><ReceiptText size={18}/></div><div className="sales-product-info"><b>{p.name}</b><small>{[p.brand,p.model,p.sku].filter(Boolean).join(" · ")||p.category||"Producto"}</small><strong>{fmt(p.selling_price)}</strong><small className={p.stock_quantity<1?"danger":"muted"}>{p.stock_quantity} disponibles{p.has_imei?" · control por IMEI/serial":""}</small></div><button type="button" className="icon-button" aria-label={"Agregar "+p.name} title="Agregar al carrito" disabled={p.stock_quantity<1||cart.find(l=>l.product.id===p.id)?.quantity===p.stock_quantity} onClick={()=>add(p)}><Plus size={16}/></button></article>)}</div>}
   </section>
   <section className="panel sales-checkout"><div className="panel-head"><div><h2>Resumen de venta</h2><p>Confirma los artículos y los datos de cobro.</p></div><ShoppingCart size={19}/></div>
    <form onSubmit={submit}>
     <div className="field sales-customer-picker"><div className="sales-customer-label"><label><UserRound size={13} style={{display:"inline",verticalAlign:"-2px"}}/> Cliente (opcional)</label><button type="button" className="button secondary sales-add-customer" onClick={()=>{setShowNewCustomer(v=>!v);setCustomerSearch("")}}><UserPlus size={13}/>{showNewCustomer?"Cerrar":"Nuevo cliente"}</button></div>{customerId? <div className="sales-selected-customer"><div><b>{customers.find(c=>c.id===customerId)?.full_name??"Cliente seleccionado"}</b><small>{customers.find(c=>c.id===customerId)?.phone??"Sin teléfono registrado"}</small></div><button type="button" className="button secondary" onClick={()=>{setCustomerId("");setCustomerSearch("")}}>Quitar</button></div>:<><input value={customerSearch} onChange={e=>setCustomerSearch(e.target.value)} placeholder="Buscar cliente por nombre o teléfono…" aria-label="Buscar cliente por nombre o teléfono"/><p className="sales-customer-hint">Déjalo vacío para una venta de mostrador.</p>{customerSearch.trim()&&<div className="sales-customer-results">{customers.filter(c=>(c.full_name+" "+(c.phone??"")).toLocaleLowerCase("es").includes(customerSearch.trim().toLocaleLowerCase("es"))).slice(0,6).map(c=><button type="button" key={c.id} onClick={()=>{setCustomerId(c.id);setCustomerSearch("")}}><span><b>{c.full_name}</b><small>{c.phone??"Sin teléfono"}</small></span><span>Seleccionar</span></button>)}{customers.filter(c=>(c.full_name+" "+(c.phone??"")).toLocaleLowerCase("es").includes(customerSearch.trim().toLocaleLowerCase("es"))).length===0&&<p className="sales-customer-no-results">No encontramos coincidencias.</p>}</div>}</>}</div>
     {showNewCustomer&&<div className="sales-new-customer"><div className="panel-head"><div><h3>Registrar cliente</h3><p>Se guardará y quedará seleccionado en esta venta.</p></div><button type="button" className="icon-button" aria-label="Cerrar" onClick={()=>setShowNewCustomer(false)}><X size={14}/></button></div><div className="field"><label>Nombre completo *</label><input required maxLength={160} value={newCustomer.full_name} onChange={e=>setNewCustomer({...newCustomer,full_name:e.target.value})} placeholder="Nombre y apellidos"/></div><div className="field"><label>Teléfono / WhatsApp</label><input maxLength={40} value={newCustomer.phone} onChange={e=>setNewCustomer({...newCustomer,phone:e.target.value})} placeholder="+57…"/></div><div className="field"><label>Correo electrónico</label><input type="email" maxLength={254} value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer,email:e.target.value})} placeholder="cliente@correo.com"/></div><div className="field"><label>Documento / identificación</label><input maxLength={80} value={newCustomer.document_number} onChange={e=>setNewCustomer({...newCustomer,document_number:e.target.value})} placeholder="Cédula, NIT u otro"/></div><button type="button" className="button sales-new-customer-save" disabled={customerSaving||!newCustomer.full_name.trim()} onClick={()=>void createCustomer()}>{customerSaving?"Guardando…":"Guardar y asociar"}</button></div>}
     <div className="sales-cart">{cart.length===0?<div className="empty">Agrega productos desde el catálogo para iniciar.</div>:cart.map(l=><div className="sales-cart-line" key={l.product.id}><div className="sales-cart-name"><b>{l.product.name}</b><small>{fmt(l.product.selling_price)} c/u</small></div><div className="sales-qty"><button type="button" className="icon-button" aria-label="Disminuir" onClick={()=>setCart(old=>old.map(x=>x.product.id===l.product.id?{...x,quantity:Math.max(1,x.quantity-1),serial_ids:x.serial_ids.slice(0,Math.max(1,x.quantity-1))}:x))}><Minus size={12}/></button><b>{l.quantity}</b><button type="button" className="icon-button" aria-label="Aumentar" disabled={l.quantity>=l.product.stock_quantity} onClick={()=>quantity(l.product.id,1)}><Plus size={12}/></button><button type="button" className="icon-button delete-button" aria-label="Quitar" onClick={()=>remove(l.product.id)}><Trash2 size={13}/></button></div><strong className="sales-line-total">{fmt(l.product.selling_price*l.quantity)}</strong>{l.product.has_imei&&<div className="sales-serials">{Array.from({length:l.quantity},(_,idx)=><div className="field" key={idx}><label>IMEI / serial · unidad {idx+1}</label><select value={l.serial_ids[idx]??""} onChange={e=>setCart(old=>old.map(x=>x.product.id===l.product.id?{...x,serial_ids:Array.from({length:x.quantity},(_,j)=>j===idx?e.target.value:(x.serial_ids[j]??""))}:x))} required><option value="">Selecciona serial disponible</option>{serials.filter(s=>s.product_id===l.product.id&&(!cart.some(x=>x.product.id!==l.product.id&&x.serial_ids.includes(s.id))||l.serial_ids.includes(s.id))).map(s=><option value={s.id} key={s.id}>{s.serial_number}</option>)}</select></div>)}</div>}</div>)}</div>
     <div className="field"><label>Descuento total (COP)</label><input type="number" min="0" max={subtotal} step="1" value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
     <div className="sales-totals"><div><span>Subtotal</span><b>{fmt(subtotal)}</b></div><div><span>Descuento</span><b>− {fmt(discountValue)}</b></div><div className="sales-grand-total"><span>Total</span><strong>{fmt(total)}</strong></div></div>
     <div className="sales-pay-head"><div><h3>Medios de pago</h3><p>Puedes dividir el pago entre varios medios.</p></div><button type="button" className="button secondary" onClick={()=>setPayments(p=>[...p,{method:"cash",amount:"",reference:""}])}><Plus size={13}/> Añadir</button></div>
     {payments.map((p,i)=><div className="sales-payment" key={i}><div className="field"><label>Medio</label><select value={p.method} onChange={e=>changePayment(i,{method:e.target.value as PayMethod})}>{methods.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}</select></div><div className="field"><label>Valor (COP)</label><input type="number" min="0" step="1" value={p.amount} onChange={e=>changePayment(i,{amount:e.target.value})} placeholder="0"/></div><div className="field sales-reference"><label>Referencia (opcional)</label><input value={p.reference} onChange={e=>changePayment(i,{reference:e.target.value})} placeholder="N.º operación"/></div>{payments.length>1&&<button type="button" className="icon-button delete-button" aria-label="Quitar medio de pago" onClick={()=>setPayments(old=>old.filter((_,j)=>j!==i))}><Trash2 size={14}/></button>}</div>)}
     <div className="sales-paid"><span>Recibido</span><b>{fmt(paid)}</b><span>{balance>0?"Pendiente":"Saldo"}</span><b className={balance>0?"negative":"success"}>{fmt(balance)}</b></div>
     <div className="field"><label>Notas (opcional)</label><textarea rows={2} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Observaciones de la venta…"/></div>
     <div className={`sales-payment-feedback ${paid>total?"is-error":Math.abs(paid-total)<=0.5&&total>0?"is-ready":"is-pending"}`} role="status">{!cart.length?"Agrega productos para habilitar la confirmación.":total<=0?"El total debe ser mayor que cero.":paid>total?`Los pagos superan el total por ${fmt(paid-total)}.`:Math.abs(paid-total)>0.5?`Falta cubrir ${fmt(total-paid)} para completar el pago.`:"El pago cubre el total de la venta."}</div>
     <button type="submit" className="button sales-submit" disabled={saving||loading||cart.length===0}><Banknote size={17}/>{saving?"Registrando venta…":"Confirmar venta"}</button>
     <p className="sales-footnote"><CreditCard size={13}/> Al confirmar, el sistema valida permisos, caja, pagos y existencias antes de guardar la venta.</p>
    </form>
   </section>
  </div>
  </>}\n  {activeView==="history"&&<section className="panel sales-history" id="sales-history"><div className="panel-head"><div><h2>Historial de ventas</h2><p>Últimas 30 operaciones · abre una venta para ver el detalle o reimprimir su ticket.</p></div><Clock3 size={18}/></div>{loading?<div className="empty">Cargando ventas…</div>:sales.length===0?<div className="empty">Aún no hay ventas registradas.</div>:<div className="table-wrap"><table><thead><tr><th>Venta</th><th>Fecha</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Ticket</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td><b>#{s.sale_number}</b></td><td>{new Date(s.created_at).toLocaleString("es-CO",{dateStyle:"short",timeStyle:"short"})}</td><td>{s.customers?.full_name??"Mostrador"}</td><td><span className="pill">{s.status==="completed"?"Pagada":s.status==="pending"?"Pendiente":s.status}</span></td><td><b>{fmt(Number(s.total))}</b></td><td><button type="button" className="button secondary sales-history-view" disabled={receiptLoading} onClick={()=>void viewSale(s)}><Printer size={13}/> Ver / imprimir</button></td></tr>)}</tbody></table></div>}</section>}{activeView==="history"&&receipt&&<section className="panel sales-receipt-preview"><div className="panel-head"><div><h2>Comprobante de venta #{receipt.sale_number}</h2><p>{new Date(receipt.created_at).toLocaleString("es-CO",{dateStyle:"medium",timeStyle:"short"})} · {receipt.customer_name}</p></div><button type="button" className="button" onClick={()=>printReceipt(receipt)}><Printer size={14}/> Imprimir ticket</button></div><div className="sales-receipt-items">{receipt.items.map((item,i)=><div className="sales-receipt-item" key={i}><div><b>{item.name}</b><small>{item.quantity} × {fmt(item.unit_price)}{item.serial_number?" · "+item.serial_number:""}</small></div><strong>{fmt(item.line_total)}</strong></div>)}</div><div className="sales-receipt-totals"><div><span>Subtotal</span><b>{fmt(receipt.subtotal)}</b></div><div><span>Descuento</span><b>− {fmt(receipt.discount)}</b></div><div className="sales-receipt-grand"><span>Total</span><strong>{fmt(receipt.total)}</strong></div><div className="sales-receipt-payments"><b>Medios de pago</b>{receipt.payments.map((p,i)=><div key={i}><span>{paymentLabel(p.method)}{p.reference?" · "+p.reference:""}</span><b>{fmt(p.amount)}</b></div>)}</div>{receipt.notes&&<p className="sales-receipt-notes">Notas: {receipt.notes}</p>}</div></section>}
 </div>
}
