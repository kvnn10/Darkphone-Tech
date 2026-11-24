"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, RefreshCw, Receipt, X, CalendarDays, TrendingDown, Save, Wallet } from "lucide-react";

type Movement = {
  id: string;
  movement_date: string;
  amount: number;
  payment_channel: string | null;
  description: string;
  source: string | null;
  source_message: string | null;
  created_at: string;
};
type ExpenseForm = {
  concept: string;
  category: string;
  amount: string;
  payment_channel: "cash" | "bank_transfer" | "unknown";
  movement_date: string;
};
const categories = ["Arriendo", "Servicios públicos", "Nómina", "Inventario e insumos", "Transporte", "Marketing", "Mantenimiento", "Comisiones bancarias", "Impuestos", "Otros"];
const methods = [
  { value: "cash", label: "Efectivo" },
  { value: "bank_transfer", label: "Transferencia bancaria" },
  { value: "unknown", label: "No especificado" },
] as const;
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const blank = (): ExpenseForm => ({ concept: "", category: "Otros", amount: "", payment_channel: "cash", movement_date: today() });
const money = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const shortDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
const methodLabel = (value: string | null) => methods.find(m => m.value === value)?.label ?? (value === "unknown" || !value ? "No especificado" : value);
function categoryFor(m: Movement) {
  const text = (m.description + " " + (m.source_message ?? "")).toLocaleLowerCase("es");
  if (/nómina|quincena|daniel|kevin/.test(text)) return "Nómina";
  if (/arriendo/.test(text)) return "Arriendo";
  if (/servicio|internet|energía|agua/.test(text)) return "Servicios públicos";
  if (/domicilio|transporte|envío|mensajería/.test(text)) return "Transporte";
  if (/marketing|publicidad|anuncio/.test(text)) return "Marketing";
  if (/comisión bancaria|banco/.test(text)) return "Comisiones bancarias";
  if (/impuesto|retefuente|iva/.test(text)) return "Impuestos";
  if (/compra|batería|display|pantalla|tapa|repuesto|iphone|flex|incell|inventario/.test(text)) return "Inventario e insumos";
  if (/arreglo|reparación|mantenimiento/.test(text)) return "Mantenimiento";
  return "Otros";
}
function sourceLabel(source: string | null) {
  if (source === "sale_void") return "Anulación de venta";
  if (source === "whatsapp_history_2025_2026" || source === "whatsapp_october_2026") return "WhatsApp / Caja";
  if (source === "sale") return "Venta / devolución";
  if (source === "cash") return "Caja";
  return "Registro manual";
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [period, setPeriod] = useState("month");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ExpenseForm>(blank());

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase no está configurado. Verifica las variables de entorno.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("financial_movements")
      .select("id,movement_date,amount,payment_channel,description,source,source_message,created_at")
      .eq("direction", "expense")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(5000);
    if (error) {
      setExpenses([]);
      setMessage("No se pudieron cargar los egresos: " + error.message);
    } else {
      setExpenses((data ?? []) as Movement[]);
      setMessage("");
    }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const q = query.trim().toLocaleLowerCase("es");
    return expenses.filter(e => {
      const d = new Date(e.movement_date + "T12:00:00");
      const inPeriod = period === "all" || (period === "month" && d >= monthStart) || (period === "year" && d >= yearStart);
      const category = categoryFor(e);
      const inCategory = categoryFilter === "all" || category === categoryFilter;
      const matches = [e.description, e.source_message, category, sourceLabel(e.source)].some(v => v?.toLocaleLowerCase("es").includes(q));
      return inPeriod && inCategory && matches;
    });
  }, [expenses, query, categoryFilter, period]);

  const totalShown = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const monthRows = expenses.filter(e => e.movement_date >= today().slice(0, 7) + "-01" && e.movement_date <= today());
  const totalMonth = monthRows.reduce((sum, e) => sum + Number(e.amount), 0);
  const averageMonth = monthRows.length ? totalMonth / monthRows.length : 0;

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage("Ingresa un valor mayor que cero."); return; }
    setSaving(true); setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const result = await supabase.from("financial_movements").insert({
      movement_date: form.movement_date,
      direction: "expense",
      amount,
      payment_channel: form.payment_channel,
      description: form.concept.trim(),
      pending_amount: 0,
      source: "manual",
      source_key: "manual-expense-" + crypto.randomUUID(),
      source_message: "Categoría: " + form.category,
      ...(authData.user ? { created_by: authData.user.id } : {}),
    });
    setSaving(false);
    if (result.error) { setMessage("No se pudo registrar el egreso: " + result.error.message); return; }
    setShowForm(false); setForm(blank());
    setMessage("Egreso registrado en el libro financiero y reflejado en Caja.");
    await load();
  }

  return <div className="content expenses-page">
    <div className="page-head">
      <div><div className="eyebrow">CONTROL FINANCIERO</div><h1>Gastos</h1><p>Consulta los egresos registrados en Caja y en el historial financiero, sin duplicar movimientos.</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="button secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Actualizar</button>
        <button className="button" onClick={() => { setForm(blank()); setShowForm(true); setMessage(""); }}><Plus size={16}/> Registrar egreso</button>
      </div>
    </div>
    {message && <div className="notice" role="status">{message}</div>}
    <div className="grid stats expenses-stats">
      <article className="stat"><label>Egresos del mes</label><strong>{money(totalMonth)}</strong><small>Movimientos del mes actual</small></article>
      <article className="stat"><label>Registros del mes</label><strong>{monthRows.length}</strong><small>Egresos contabilizados</small></article>
      <article className="stat"><label>Promedio por egreso</label><strong>{money(averageMonth)}</strong><small>Promedio mensual</small></article>
      <article className="stat"><label>Total filtrado</label><strong>{money(totalShown)}</strong><small>{filtered.length} movimientos visibles</small></article>
    </div>

    {showForm && <section className="panel expenses-form">
      <div className="panel-head"><div><h2>Nuevo egreso</h2><p>Se guardará directamente en el registro financiero para que Caja y Gastos compartan la misma información.</p></div><button className="icon-button" aria-label="Cerrar formulario" onClick={() => setShowForm(false)}><X size={17}/></button></div>
      <form onSubmit={save}>
        <div className="form-grid">
          <div className="field"><label htmlFor="expense-concept">Concepto *</label><input id="expense-concept" required minLength={2} maxLength={180} value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} placeholder="Ej. Pago de internet" /></div>
          <div className="field"><label htmlFor="expense-category">Categoría *</label><select id="expense-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="expense-amount">Valor (COP) *</label><input id="expense-amount" type="number" min="1" step="1" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
          <div className="field"><label htmlFor="expense-date">Fecha del egreso *</label><input id="expense-date" type="date" required value={form.movement_date} onChange={e => setForm({ ...form, movement_date: e.target.value })} /></div>
          <div className="field"><label htmlFor="expense-method">Medio de pago *</label><select id="expense-method" value={form.payment_channel} onChange={e => setForm({ ...form, payment_channel: e.target.value as ExpenseForm["payment_channel"] })}>{methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
        </div>
        <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="button" type="submit" disabled={saving}>{saving ? "Guardando..." : <><Save size={15}/> Guardar egreso</>}</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><h2>Registro de egresos</h2><p>Fuente única: movimientos financieros existentes. Los registros se conservan en su módulo de origen.</p></div><Receipt size={19} className="muted"/></div>
      <div className="toolbar expenses-toolbar">
        <div className="expenses-search"><Search size={15}/><input aria-label="Buscar egresos" className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar concepto, categoría o fuente..." /></div>
        <select aria-label="Filtrar por periodo" className="filter-select" value={period} onChange={e => setPeriod(e.target.value)}><option value="month">Este mes</option><option value="year">Este año</option><option value="all">Todo el historial</option></select>
        <select aria-label="Filtrar por categoría" className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Todas las categorías</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
      </div>
      {loading ? <div className="empty">Cargando egresos...</div> : filtered.length === 0 ? <div className="empty"><TrendingDown size={24} style={{ margin: "0 auto 8px" }}/><div>No hay egresos para estos filtros.</div><p>Prueba otro periodo o registra un egreso nuevo.</p></div> :
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Medio de pago</th><th>Origen</th><th style={{ textAlign: "right" }}>Valor</th></tr></thead><tbody>
        {filtered.map(e => <tr key={e.id}><td>{shortDate(e.movement_date)}</td><td><strong>{e.description}</strong>{e.source_message && <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{e.source_message}</div>}</td><td><span className="pill">{categoryFor(e)}</span></td><td>{methodLabel(e.payment_channel)}</td><td>{sourceLabel(e.source)}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{money(e.amount)}</td></tr>)}
      </tbody></table></div>}
      <div className="expenses-foot"><CalendarDays size={14}/> Los valores están expresados en pesos colombianos (COP). Cada egreso se muestra desde su movimiento original; no se vuelve a descontar del saldo.</div>
    </section>
    <style jsx>{`
      .expenses-search{position:relative;flex:1;min-width:220px;display:flex;align-items:center}
      .expenses-search :global(svg){position:absolute;left:11px;color:#8293a7;pointer-events:none}
      .expenses-search .search{padding-left:34px}
      .filter-select{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px;font-size:12px;color:var(--ink);max-width:210px}
      .icon-button{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--muted);cursor:pointer}
      .expenses-foot{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;margin-top:15px}
      @media(max-width:800px){.expenses-toolbar{align-items:stretch;flex-direction:column}.filter-select{max-width:none}.expenses-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}
