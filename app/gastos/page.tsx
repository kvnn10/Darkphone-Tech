"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Search, RefreshCw, Receipt, Trash2, X, CalendarDays, WalletCards, TrendingDown, Pencil, Save } from "lucide-react";

type Expense = {
  id: string;
  concept: string;
  category: string;
  amount: number;
  payment_method: "cash" | "bank_transfer" | "debit_card" | "credit_card" | "nequi" | "daviplata" | "other";
  expense_date: string;
  responsible: string | null;
  notes: string | null;
  created_at: string;
};
type ExpenseForm = {
  concept: string; category: string; amount: string; payment_method: Expense["payment_method"];
  expense_date: string; responsible: string; notes: string;
};
const categories = ["Arriendo", "Servicios públicos", "Nómina", "Inventario e insumos", "Transporte", "Marketing", "Mantenimiento", "Comisiones bancarias", "Impuestos", "Otros"];
const methods: { value: Expense["payment_method"]; label: string }[] = [
  { value: "cash", label: "Efectivo" }, { value: "bank_transfer", label: "Transferencia bancaria" },
  { value: "debit_card", label: "Tarjeta débito" }, { value: "credit_card", label: "Tarjeta crédito" },
  { value: "nequi", label: "Nequi" }, { value: "daviplata", label: "DaviPlata" }, { value: "other", label: "Otro medio" },
];
const today = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const blank = (): ExpenseForm => ({ concept: "", category: "Otros", amount: "", payment_method: "cash", expense_date: today(), responsible: "", notes: "" });
const money = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n) || 0);
const shortDate = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [period, setPeriod] = useState("month");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<ExpenseForm>(blank());

  const load = useCallback(async () => {
    if (!supabase) {
      setMessage("Supabase no está configurado. Verifica las variables de entorno antes de registrar gastos.");
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.from("expenses")
      .select("id,concept,category,amount,payment_method,expense_date,responsible,notes,created_at")
      .order("expense_date", { ascending: false }).order("created_at", { ascending: false }).limit(2000);
    if (error) {
      setExpenses([]);
      setMessage(error.code === "42P01" || error.code === "PGRST205"
        ? "Falta crear la tabla de gastos en Supabase. Aplica la migración 202610240002_create_expenses_module.sql."
        : "No se pudieron cargar los gastos: " + error.message);
    } else {
      setExpenses((data ?? []) as Expense[]);
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
    return expenses.filter((e) => {
      const d = new Date(e.expense_date + "T12:00:00");
      const inPeriod = period === "all" || (period === "month" && d >= monthStart) || (period === "year" && d >= yearStart);
      const inCategory = categoryFilter === "all" || e.category === categoryFilter;
      const matches = [e.concept, e.category, e.responsible, e.notes].some(v => v?.toLocaleLowerCase("es").includes(q));
      return inPeriod && inCategory && matches;
    });
  }, [expenses, query, categoryFilter, period]);

  const totalShown = filtered.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalMonth = expenses.filter(e => e.expense_date >= today().slice(0, 7) + "-01" && e.expense_date <= today()).reduce((sum, e) => sum + Number(e.amount), 0);
  const countMonth = expenses.filter(e => e.expense_date >= today().slice(0, 7) + "-01" && e.expense_date <= today()).length;
  const averageMonth = countMonth ? totalMonth / countMonth : 0;

  function openNew() { setEditing(null); setForm(blank()); setShowForm(true); setMessage(""); }
  function openEdit(e: Expense) {
    setEditing(e.id);
    setForm({ concept: e.concept, category: e.category, amount: String(e.amount), payment_method: e.payment_method, expense_date: e.expense_date, responsible: e.responsible ?? "", notes: e.notes ?? "" });
    setShowForm(true); setMessage("");
  }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!supabase) return;
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) { setMessage("Ingresa un valor mayor que cero."); return; }
    setSaving(true); setMessage("");
    const { data: authData } = await supabase.auth.getUser();
    const payload = {
      concept: form.concept.trim(), category: form.category, amount,
      payment_method: form.payment_method, expense_date: form.expense_date,
      responsible: form.responsible.trim() || null, notes: form.notes.trim() || null,
      ...(!editing && authData.user ? { created_by: authData.user.id } : {}),
    };
    const result = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing)
      : await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (result.error) { setMessage("No se pudo guardar el gasto: " + result.error.message); return; }
    setShowForm(false); setEditing(null); setForm(blank());
    setMessage(editing ? "Gasto actualizado correctamente." : "Gasto registrado correctamente.");
    await load();
  }
  async function removeExpense(expense: Expense) {
    if (!supabase || !window.confirm(`¿Eliminar el gasto "${expense.concept}" por ${money(expense.amount)}? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from("expenses").delete().eq("id", expense.id);
    if (error) { setMessage("No se pudo eliminar el gasto: " + error.message); return; }
    setMessage("Gasto eliminado."); await load();
  }

  return <div className="content expenses-page">
    <div className="page-head">
      <div><div className="eyebrow">CONTROL FINANCIERO</div><h1>Gastos</h1><p>Registra salidas de dinero y controla los costos operativos de DarkPhone Tech.</p></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button className="button secondary" onClick={() => void load()} disabled={loading}><RefreshCw size={15}/> Actualizar</button>
        <button className="button" onClick={openNew}><Plus size={16}/> Registrar gasto</button>
      </div>
    </div>
    {message && <div className="notice" role="status">{message}</div>}
    <div className="grid stats expenses-stats">
      <article className="stat"><label>Gastos del mes</label><strong>{money(totalMonth)}</strong><small>Desde el primer día del mes</small></article>
      <article className="stat"><label>Registros del mes</label><strong>{countMonth}</strong><small>Gastos contabilizados</small></article>
      <article className="stat"><label>Promedio por gasto</label><strong>{money(averageMonth)}</strong><small>Promedio mensual</small></article>
      <article className="stat"><label>Total filtrado</label><strong>{money(totalShown)}</strong><small>{filtered.length} registros visibles</small></article>
    </div>

    {showForm && <section className="panel expenses-form">
      <div className="panel-head"><div><h2>{editing ? "Editar gasto" : "Nuevo gasto"}</h2><p>Completa los datos para mantener el registro contable.</p></div><button className="icon-button" aria-label="Cerrar formulario" onClick={() => setShowForm(false)}><X size={17}/></button></div>
      <form onSubmit={save}>
        <div className="form-grid">
          <div className="field"><label htmlFor="expense-concept">Concepto *</label><input id="expense-concept" required minLength={2} maxLength={160} value={form.concept} onChange={e => setForm({ ...form, concept: e.target.value })} placeholder="Ej. Pago de internet" /></div>
          <div className="field"><label htmlFor="expense-category">Categoría *</label><select id="expense-category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{categories.map(c => <option key={c}>{c}</option>)}</select></div>
          <div className="field"><label htmlFor="expense-amount">Valor (COP) *</label><input id="expense-amount" type="number" min="1" step="1" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="0" /></div>
          <div className="field"><label htmlFor="expense-date">Fecha del gasto *</label><input id="expense-date" type="date" required value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></div>
          <div className="field"><label htmlFor="expense-method">Medio de pago *</label><select id="expense-method" value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value as Expense["payment_method"] })}>{methods.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
          <div className="field"><label htmlFor="expense-responsible">Responsable</label><input id="expense-responsible" maxLength={100} value={form.responsible} onChange={e => setForm({ ...form, responsible: e.target.value })} placeholder="Nombre de quien registra o paga" /></div>
          <div className="field" style={{ gridColumn: "1 / -1" }}><label htmlFor="expense-notes">Notas / referencia</label><input id="expense-notes" maxLength={500} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Factura, proveedor, observaciones..." /></div>
        </div>
        <div className="form-actions"><button type="button" className="button secondary" onClick={() => setShowForm(false)}>Cancelar</button><button className="button" type="submit" disabled={saving}>{saving ? "Guardando..." : <><Save size={15}/> {editing ? "Guardar cambios" : "Guardar gasto"}</>}</button></div>
      </form>
    </section>}

    <section className="panel">
      <div className="panel-head"><div><h2>Registro de gastos</h2><p>Consulta, filtra, corrige o elimina registros.</p></div><Receipt size={19} className="muted"/></div>
      <div className="toolbar expenses-toolbar">
        <div className="expenses-search"><Search size={15}/><input aria-label="Buscar gastos" className="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar concepto, categoría o responsable..." /></div>
        <select aria-label="Filtrar por periodo" className="filter-select" value={period} onChange={e => setPeriod(e.target.value)}><option value="month">Este mes</option><option value="year">Este año</option><option value="all">Todo el historial</option></select>
        <select aria-label="Filtrar por categoría" className="filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">Todas las categorías</option>{categories.map(c => <option key={c}>{c}</option>)}</select>
      </div>
      {loading ? <div className="empty">Cargando gastos...</div> : filtered.length === 0 ? <div className="empty"><TrendingDown size={24} style={{ margin: "0 auto 8px" }}/><div>No hay gastos para estos filtros.</div><p>Registra un gasto o cambia el periodo seleccionado.</p></div> :
      <div className="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Categoría</th><th>Medio de pago</th><th>Responsable</th><th style={{ textAlign: "right" }}>Valor</th><th>Acciones</th></tr></thead><tbody>
        {filtered.map(e => <tr key={e.id}><td>{shortDate(e.expense_date)}</td><td><strong>{e.concept}</strong>{e.notes && <div className="muted" style={{ fontSize: 10, marginTop: 4 }}>{e.notes}</div>}</td><td><span className="pill">{e.category}</span></td><td>{methods.find(m => m.value === e.payment_method)?.label ?? "Otro medio"}</td><td>{e.responsible || "—"}</td><td style={{ textAlign: "right", fontWeight: 700 }}>{money(e.amount)}</td><td><div className="row-actions"><button className="icon-button" title="Editar gasto" aria-label={`Editar ${e.concept}`} onClick={() => openEdit(e)}><Pencil size={15}/></button><button className="icon-button danger" title="Eliminar gasto" aria-label={`Eliminar ${e.concept}`} onClick={() => void removeExpense(e)}><Trash2 size={15}/></button></div></td></tr>)}
      </tbody></table></div>}
      <div className="expenses-foot"><CalendarDays size={14}/> Los valores están expresados en pesos colombianos (COP). Los permisos de lectura y escritura se validan en Supabase.</div>
    </section>
    <style jsx>{`
      .expenses-search{position:relative;flex:1;min-width:220px;display:flex;align-items:center}
      .expenses-search :global(svg){position:absolute;left:11px;color:#8293a7;pointer-events:none}
      .expenses-search .search{padding-left:34px}
      .filter-select{border:1px solid var(--line);border-radius:8px;background:#fff;padding:10px;font-size:12px;color:var(--ink);max-width:210px}
      .icon-button{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--muted);cursor:pointer}
      .icon-button:hover{background:#f0f7fd;color:var(--blue)}
      .icon-button.danger:hover{background:#fff1f0;color:#bd3028;border-color:#ffd0cb}
      .row-actions{display:flex;gap:6px}
      .expenses-foot{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:11px;margin-top:15px}
      @media(max-width:800px){.expenses-toolbar{align-items:stretch;flex-direction:column}.filter-select{max-width:none}.expenses-stats{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `}</style>
  </div>;
}
