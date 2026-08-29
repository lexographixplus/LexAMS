import { useMemo, useState } from 'react';
import { Edit3, ExternalLink, Plus, ReceiptText, Trash2, WalletCards, X } from 'lucide-react';
import { BUDGET_CURRENCIES, calculateBudgetSummary } from '../../../shared/planning.js';

const EMPTY_ITEM = { category: 'General', item_name: '', planned_amount: '', actual_amount: '', evidence_date: '', notes: '', evidence_url: '' };

function dateValue(value) { return value ? String(value).slice(0, 10) : ''; }

function money(value, currency) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function BudgetDialog({ initial, activity, saving, onClose, onSave }) {
  const [form, setForm] = useState(() => initial ? {
    ...EMPTY_ITEM,
    ...initial,
    planned_amount: initial.planned_amount ?? '',
    actual_amount: initial.actual_amount ?? '',
    evidence_date: dateValue(initial.evidence_date),
  } : { ...EMPTY_ITEM });
  return <div className="planning-modal-backdrop" onMouseDown={event => event.target === event.currentTarget && !saving && onClose()}>
    <section className="planning-modal" role="dialog" aria-modal="true" aria-labelledby="planning-budget-title">
      <header><div><span className="planning-kicker">Activity budget</span><h4 id="planning-budget-title">{initial ? 'Edit budget item' : 'Add budget item'}</h4><p>Track the plan and expenditure without turning LexAMS into an accounting ledger.</p></div><button className="planning-icon-button" onClick={onClose} aria-label="Close"><X size={18}/></button></header>
      <div className="planning-form-grid">
        <label className="wide"><span>Budget item</span><input autoFocus value={form.item_name} onChange={event => setForm({ ...form, item_name: event.target.value })} placeholder="Venue hire"/></label>
        <label><span>Category</span><input value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} list="planning-budget-categories" placeholder="Logistics"/><datalist id="planning-budget-categories"><option value="Venue"/><option value="Catering"/><option value="Transport"/><option value="Materials"/><option value="Facilitation"/><option value="Communications"/><option value="Other"/></datalist></label>
        <label><span>Evidence date</span><input type="date" value={form.evidence_date} onChange={event => setForm({ ...form, evidence_date: event.target.value })}/></label>
        <label><span>Planned amount ({activity.budget_currency})</span><input type="number" min="0" step="0.01" value={form.planned_amount} onChange={event => setForm({ ...form, planned_amount: event.target.value })} placeholder="Leave blank if unplanned"/></label>
        <label><span>Actual amount ({activity.budget_currency})</span><input type="number" min="0" step="0.01" value={form.actual_amount} onChange={event => setForm({ ...form, actual_amount: event.target.value })} placeholder="Leave blank until spent"/></label>
        <label className="wide"><span>Notes</span><textarea value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="Purpose, supplier, quantity or context for the variance."/></label>
        <label className="wide"><span>Receipt or evidence link</span><input type="url" value={form.evidence_url} onChange={event => setForm({ ...form, evidence_url: event.target.value })} placeholder="https://drive.example.org/receipt"/></label>
      </div>
      <footer><button className="planning-secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="planning-primary-button" onClick={() => onSave(form)} disabled={saving || !form.item_name.trim()}>{saving ? 'Saving…' : 'Save budget item'}</button></footer>
    </section>
  </div>;
}

export default function PlanningBudget({ data, saving, onMutate }) {
  const [dialog, setDialog] = useState(null);
  const [category, setCategory] = useState('all');
  const summary = useMemo(() => calculateBudgetSummary(data.budgetItems), [data.budgetItems]);
  const currency = data.activity.budget_currency || 'GMD';
  const categories = useMemo(() => [...new Set(data.budgetItems.map(item => item.category || 'General'))].sort(), [data.budgetItems]);
  const visible = category === 'all' ? data.budgetItems : data.budgetItems.filter(item => (item.category || 'General') === category);
  const canManage = data.permissions.canManageBudget;

  async function save(item) {
    const response = await onMutate('save_budget_item', { item: dialog?.id ? { ...item, id: dialog.id } : item }, dialog?.id ? 'Budget item updated.' : 'Budget item added.');
    if (response) setDialog(null);
  }

  async function remove(item) {
    if (!window.confirm(`Delete “${item.item_name}” from this activity budget?`)) return;
    await onMutate('delete_budget_item', { itemId: item.id }, 'Budget item deleted.');
  }

  const usedTone = summary.usedPercent === null ? 'neutral' : summary.usedPercent > 100 ? 'danger' : summary.usedPercent >= 85 ? 'warning' : 'good';
  return <div className="planning-section-stack">
    <div className="planning-toolbar"><div><h4>Activity budget</h4><p>Compare planned and actual costs, explain variances, and keep supporting evidence close to the activity.</p></div><div className="planning-toolbar-actions"><select value={category} onChange={event => setCategory(event.target.value)} aria-label="Filter budget category"><option value="all">All categories</option>{categories.map(value => <option value={value} key={value}>{value}</option>)}</select>{canManage && <select value={currency} onChange={event => onMutate('set_budget_currency', { currency: event.target.value }, 'Budget currency updated.')} aria-label="Budget currency">{BUDGET_CURRENCIES.map(value => <option value={value} key={value}>{value}</option>)}</select>}{canManage && <button className="planning-primary-button" onClick={() => setDialog({})}><Plus size={15}/>Add item</button>}</div></div>
    <div className="planning-budget-summary">
      <article><span>Planned</span><strong>{money(summary.planned, currency)}</strong><small>{summary.itemCount} budget item{summary.itemCount === 1 ? '' : 's'}</small></article>
      <article><span>Actual spent</span><strong>{money(summary.actual, currency)}</strong><small>{summary.usedPercent === null ? 'No planned total yet' : `${summary.usedPercent}% of plan`}</small></article>
      <article className={summary.variance < 0 ? 'danger' : ''}><span>{summary.variance < 0 ? 'Over budget' : 'Remaining'}</span><strong>{money(Math.abs(summary.variance), currency)}</strong><small>{summary.unplannedItems ? `${summary.unplannedItems} unplanned spend item${summary.unplannedItems === 1 ? '' : 's'}` : 'All spend has a planned value'}</small></article>
      <article className={`planning-budget-use ${usedTone}`}><span>Budget used</span><strong>{summary.usedPercent === null ? '—' : `${summary.usedPercent}%`}</strong><div className="planning-budget-meter"><i style={{ width: `${Math.min(100, summary.usedPercent || 0)}%` }}/></div></article>
    </div>
    {summary.categories.length > 1 && <section className="planning-card planning-budget-categories"><div className="planning-card-heading"><div><span className="planning-kicker">Category view</span><h4>Where the budget is going</h4></div></div><div>{summary.categories.map(item => <div key={item.category}><span>{item.category}</span><div><i style={{ width: `${summary.actual ? Math.max(3, Math.round((item.actual / summary.actual) * 100)) : 0}%` }}/></div><strong>{money(item.actual, currency)}</strong><small>{item.variance < 0 ? `${money(Math.abs(item.variance), currency)} over` : `${money(item.variance, currency)} remaining`}</small></div>)}</div></section>}
    {visible.length ? <section className="planning-budget-table"><div className="planning-budget-row planning-budget-head"><span>Item</span><span>Planned</span><span>Actual</span><span>Variance</span><span>Evidence</span><span aria-label="Actions"/></div>{visible.map(item => {
      const planned = Number(item.planned_amount || 0);
      const actual = Number(item.actual_amount || 0);
      const variance = planned - actual;
      return <article className="planning-budget-row" key={item.id}><span><strong>{item.item_name}</strong><small>{item.category || 'General'}{item.notes ? ` · ${item.notes}` : ''}</small></span><span data-label="Planned">{item.planned_amount === null ? 'Not set' : money(planned, currency)}</span><span data-label="Actual">{item.actual_amount === null ? 'Not recorded' : money(actual, currency)}</span><span data-label="Variance" className={variance < 0 ? 'planning-money-over' : 'planning-money-under'}>{item.planned_amount === null ? 'Unplanned' : `${variance < 0 ? '−' : '+'}${money(Math.abs(variance), currency)}`}</span><span data-label="Evidence">{item.evidence_url ? <a href={item.evidence_url} target="_blank" rel="noreferrer"><ExternalLink size={13}/>Open evidence</a> : item.evidence_date ? dateValue(item.evidence_date) : '—'}</span><span className="planning-row-actions">{canManage && <button onClick={() => setDialog(item)} aria-label={`Edit ${item.item_name}`}><Edit3 size={14}/></button>}{canManage && <button className="danger" onClick={() => remove(item)} aria-label={`Delete ${item.item_name}`}><Trash2 size={14}/></button>}</span></article>;
    })}</section> : <div className="planning-empty"><WalletCards size={27}/><strong>{data.budgetItems.length ? 'No items match this category' : 'No activity budget yet'}</strong><p>{data.budgetItems.length ? 'Choose another category.' : 'Add planned costs now and record actual expenditure as delivery progresses.'}</p>{canManage && !data.budgetItems.length && <button className="planning-primary-button" onClick={() => setDialog({})}><ReceiptText size={15}/>Start the budget</button>}</div>}
    {dialog && <BudgetDialog initial={dialog.id ? dialog : null} activity={data.activity} saving={saving} onClose={() => setDialog(null)} onSave={save}/>}
  </div>;
}
