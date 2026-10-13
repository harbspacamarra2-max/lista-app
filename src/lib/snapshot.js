import { getBudgetStatus, getMonthReport, getOverview, getUtangSummary, listBills, listGoals, listTransactions, spendingByMethod } from './db';
import { monthKey, monthLabel, peso, shiftMonth, today } from './format';

export async function buildSnapshot(db, settings = {}, month = monthKey()) {
  const prev = shiftMonth(month, -1);
  const [overview, report, prevReport, utang, budgets, goals, bills, recent, methods] = await Promise.all([
    getOverview(db),
    getMonthReport(db, month),
    getMonthReport(db, prev),
    getUtangSummary(db),
    getBudgetStatus(db, month),
    listGoals(db),
    listBills(db),
    listTransactions(db, { limit: 40 }),
    spendingByMethod(db, month),
  ]);

  const lines = [];
  lines.push(`Name: ${settings.name || 'unknown'}. Monthly budget: ${Number(settings.budget || 0) ? peso(Number(settings.budget)) : 'not set'}.`);
  lines.push(`Today (${today()}): spent ${peso(overview.spentToday)}. This week: ${peso(overview.spentWeek)}.`);
  lines.push(`${monthLabel(month)}: spent ${peso(report.spent)}, income ${peso(report.income)}. ${monthLabel(prev)}: spent ${peso(prevReport.spent)}.`);
  if (report.byCategory.length) {
    lines.push(`By category (${monthLabel(month)}): ${report.byCategory.map((c) => `${c.name} ${peso(c.total)} (${c.count}x)`).join('; ')}.`);
  }
  if (prevReport.byCategory.length) {
    lines.push(`By category (${monthLabel(prev)}): ${prevReport.byCategory.map((c) => `${c.name} ${peso(c.total)}`).join('; ')}.`);
  }
  if (methods.length) lines.push(`Paid with: ${methods.map((m) => `${m.method} ${peso(m.total)}`).join('; ')}.`);
  if (report.daily.length) {
    const top = [...report.daily].sort((a, b) => b.total - a.total).slice(0, 3);
    lines.push(`Biggest spending days: ${top.map((d) => `${d.date} ${peso(d.total)}`).join('; ')}.`);
  }
  if (budgets.length) {
    lines.push(`Category budgets: ${budgets.map((b) => `${b.name} ${peso(b.spent)} of ${peso(b.budget)}`).join('; ')}.`);
  }
  lines.push(`Utang: people owe the user ${peso(utang.totalOwed)} total; the user owes ${peso(utang.totalOwe)} total.`);
  const open = utang.people.filter((p) => p.owe || p.owed);
  if (open.length) {
    lines.push(
      `Per person: ${open
        .map((p) => `${p.name}${p.owed ? ` owes user ${peso(p.owed)}` : ''}${p.owe ? ` user owes ${peso(p.owe)}` : ''}${p.nextDue ? ` (next due ${p.nextDue})` : ''}`)
        .join('; ')}.`
    );
  }
  if (goals.length) {
    lines.push(`Ipon goals: ${goals.map((g) => `${g.name} ${peso(g.saved)} of ${peso(g.target)}${g.deadline ? ` by ${g.deadline}` : ''}`).join('; ')}.`);
  }
  if (bills.length) {
    lines.push(`Bills: ${bills.map((b) => `${b.name} ${peso(b.amount)} next due ${b.next_due}`).join('; ')}.`);
  }
  if (recent.length) {
    lines.push('Recent transactions:');
    for (const t of recent) {
      lines.push(`- ${t.date} ${t.kind} ${peso(t.amount)} ${t.category_name || ''} ${t.note ? `"${t.note}"` : ''} via ${t.method}`);
    }
  }
  return lines.join('\n');
}
