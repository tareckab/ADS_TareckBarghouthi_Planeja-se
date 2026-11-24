import { useState, type ReactNode } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CirclePlus, Goal, PiggyBank, Plus, Wallet } from 'lucide-react';
import type { Account, Goal as SavingGoal, Movement, Page, Summary, Workspace } from '../finance/model';
import { AccountRow, Heading, MovementList, Progress } from '../../components/finance';
import { isConfirmed, money } from '../finance/model';
import { PerformanceBadge, SpendingCard } from '../recommendations/InsightCards';

const weekdayLabels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const monthLabels = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type ChartPeriod = '7d' | '30d' | '90d' | '12m';
const chartPeriods: { id: ChartPeriod; label: string; caption: string }[] = [
  { id: '7d', label: '7 dias', caption: 'Últimos 7 dias' },
  { id: '30d', label: '30 dias', caption: 'Últimos 30 dias' },
  { id: '90d', label: '90 dias', caption: 'Últimos 90 dias' },
  { id: '12m', label: '12 meses', caption: 'Últimos 12 meses' },
];

type ChartBucket = { key: string; start: string; end: string; label: string; income: number; expenses: number };

const chartCurrency = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const shortDate = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

function buildBuckets(period: ChartPeriod, movements: Movement[]): ChartBucket[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const buckets: ChartBucket[] = [];
  const push = (start: Date, end: Date, label: string) =>
    buckets.push({ key: localDateKey(start), start: localDateKey(start), end: localDateKey(end), label, income: 0, expenses: 0 });

  if (period === '7d' || period === '30d') {
    const total = period === '7d' ? 7 : 30;
    for (let i = 0; i < total; i += 1) {
      const day = new Date(today);
      day.setDate(today.getDate() - (total - 1 - i));
      const showLabel = period === '7d' || (total - 1 - i) % 5 === 0;
      push(day, day, showLabel ? (period === '7d' ? weekdayLabels[day.getDay()] : shortDate(day)) : '');
    }
  } else if (period === '90d') {
    for (let i = 0; i < 13; i += 1) {
      const end = new Date(today);
      end.setDate(today.getDate() - (12 - i) * 7);
      const start = new Date(end);
      start.setDate(end.getDate() - 6);
      push(start, end, (12 - i) % 2 === 0 ? shortDate(start) : '');
    }
  } else {
    for (let i = 0; i < 12; i += 1) {
      const start = new Date(today.getFullYear(), today.getMonth() - (11 - i), 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      push(start, end, monthLabels[start.getMonth()]);
    }
  }

  movements.forEach((movement) => {
    const bucket = buckets.find((item) => movement.date >= item.start && movement.date <= item.end);
    if (!bucket) return;
    if (movement.kind === 'income') bucket.income += movement.amount;
    else bucket.expenses += movement.amount;
  });
  return buckets;
}

function chartAxisMaximum(value: number) {
  if (value === 0) return 0;
  const roughStep = value / 2;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;
  const step = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude;
  return step * 2;
}

export function MoneyCard({
  title,
  amount,
  detail,
  icon,
  tone,
}: {
  title: string;
  amount: number;
  detail: string;
  icon: ReactNode;
  tone: string;
}) {
  return (
    <article className="money-card">
      <div className="money-card-top">
        <span>{title}</span>
        <i className={`metric-icon ${tone}`}>{icon}</i>
      </div>
      <strong>{money(amount)}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function DashboardPage({
  name,
  workspace,
  balance,
  income,
  expenses,
  movements,
  accounts,
  accountBalance,
  goals,
  summary,
  onAdd,
  onPage,
}: {
  name: string;
  workspace: Workspace;
  balance: number;
  income: number;
  expenses: number;
  movements: Movement[];
  accounts: Account[];
  accountBalance: (a: Account) => number;
  goals: SavingGoal[];
  summary: Summary | null;
  onAdd: () => void;
  onPage: (p: Page) => void;
}) {
  const [period, setPeriod] = useState<ChartPeriod>('7d');
  // O gráfico de fluxo considera só o que de fato entrou/saiu (confirmadas).
  const chartDays = buildBuckets(period, movements.filter(isConfirmed));
  const periodInfo = chartPeriods.find((item) => item.id === period) ?? chartPeriods[0];
  const periodIncome = chartDays.reduce((sum, day) => sum + day.income, 0);
  const periodExpenses = chartDays.reduce((sum, day) => sum + day.expenses, 0);
  const dense = chartDays.length > 13;
  const chartMaximum = Math.max(
    0,
    ...chartDays.flatMap((day) => [day.income, day.expenses]),
  );
  const axisMaximum = chartAxisMaximum(chartMaximum);
  const axisLabels = [axisMaximum, axisMaximum / 2, 0];
  const goal = goals[0];
  const rate = income
    ? Math.max(0, Math.round(((income - expenses) / income) * 100))
    : 0;
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow={
          workspace === "business"
            ? "SEU NEGÓCIO, EM EQUILÍBRIO"
            : "SEU DINHEIRO, COM INTENÇÃO"
        }
        title={
          <>
            Bom dia, {name.split(" ")[0]}
            <i className="heading-dot">.</i>
          </>
        }
        description="Um passo de cada vez. Olha como está seu mês."
        action={
          <button className="button-primary" onClick={onAdd}>
            <Plus size={17} /> Novo lançamento
          </button>
        }
      />
      <section className="metrics-grid grid grid-cols-[1.2fr_1fr_1fr_1fr] gap-3 max-[1100px]:grid-cols-2 max-[480px]:gap-2">
        <article className="total-card">
          <div className="money-card-top">
            <span>Saldo total</span>
            <i className="metric-icon">
              <Wallet size={17} />
            </i>
          </div>
          <strong>{money(balance)}</strong>
          <small>
            <span className="online-dot" /> Somando {accounts.length} contas
          </small>
          <footer>
            Seu ponto de partida <ArrowUpRight size={16} />
          </footer>
        </article>
        <MoneyCard
          title="Entradas do mês"
          amount={income}
          detail="Dinheiro que chegou"
          icon={<ArrowDownLeft size={17} />}
          tone="positive"
        />
        <MoneyCard
          title="Saídas do mês"
          amount={expenses}
          detail="Dinheiro que saiu"
          icon={<ArrowUpRight size={17} />}
          tone="negative"
        />
        <article className="money-card saved-card">
          <div className="money-card-top">
            <span>Você guardou</span>
            <i className="metric-icon saved-icon">
              <PiggyBank size={17} />
            </i>
          </div>
          <strong>{money(Math.max(0, income - expenses))}</strong>
          <small>
            <b>{rate}%</b> das entradas deste mês
          </small>
          <PerformanceBadge summary={summary} />
        </article>
      </section>
      <div className="home-columns grid grid-cols-[minmax(0,1.65fr)_minmax(255px,.9fr)] gap-[14px] max-[760px]:grid-cols-1">
        <section className="panel cash-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">SEU RITMO</span>
              <h2>Como o dinheiro se move</h2>
            </div>
            <div className="segmented period-switch" role="group" aria-label="Período do gráfico">
              {chartPeriods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={item.id === period ? 'selected' : ''}
                  aria-pressed={item.id === period}
                  onClick={() => setPeriod(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-in" /> Entradas
            </span>
            <span>
              <i className="legend-out" /> Saídas
            </span>
          </div>
          <div className="chart-wrap">
            <div className="chart-labels">
              {axisLabels.map((value, index) => (
                <span key={index}>{chartCurrency.format(value)}</span>
              ))}
            </div>
            <div className={`week-chart${dense ? ' is-dense' : ''}`} style={{ gridTemplateColumns: `repeat(${chartDays.length}, minmax(0, 1fr))` }}>
              {chartDays.map((day) => {
                const earnings = day.income;
                const expenses = day.expenses;
                return (
                  <div className="chart-day" key={day.key}>
                    <div className="bars">
                      <i
                        className="bar-in"
                        style={{
                          height: earnings && axisMaximum
                            ? `${Math.max(3, (earnings / axisMaximum) * 100)}%`
                            : '0%',
                        }}
                        title={`${day.start === day.end ? shortDate(new Date(`${day.start}T12:00:00`)) : `${shortDate(new Date(`${day.start}T12:00:00`))} – ${shortDate(new Date(`${day.end}T12:00:00`))}`} · Entradas: ${money(earnings)}`}
                      />
                      <i
                        className="bar-out"
                        style={{
                          height: expenses && axisMaximum
                            ? `${Math.max(3, (expenses / axisMaximum) * 100)}%`
                            : '0%',
                        }}
                        title={`${day.start === day.end ? shortDate(new Date(`${day.start}T12:00:00`)) : `${shortDate(new Date(`${day.start}T12:00:00`))} – ${shortDate(new Date(`${day.end}T12:00:00`))}`} · Saídas: ${money(expenses)}`}
                      />
                    </div>
                    <span>{day.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-caption">
            <i /> {periodInfo.caption}
            <b>· {money(periodIncome)} em entradas · {money(periodExpenses)} em saídas</b>
          </div>
        </section>
        <div className="side-stack grid gap-[14px]">
        <SpendingCard summary={summary} onSetBudget={() => onPage("goals")} />
        <section className="panel featured-goal">
          <div className="goal-illustration">
            <i />
            <i />
            <span>
              <Goal size={22} />
            </span>
          </div>
          <span className="eyebrow">UM PLANO DE CADA VEZ</span>
          <h2>{goal?.title ?? "Qual é seu próximo plano?"}</h2>
          <p>Você já está mais perto do que imagina.</p>
          <div className="goal-progress-label">
            <span>{money(goal?.saved ?? 0)} guardados</span>
            <b>{goal ? Math.round((goal.saved / goal.target) * 100) : 0}%</b>
          </div>
          <Progress value={goal?.saved ?? 0} max={goal?.target ?? 1} />
          <div className="goal-target">
            Meta de <b>{money(goal?.target ?? 0)}</b>
          </div>
          <button className="text-action" onClick={() => onPage("goals")}>
            Acompanhar metas <ArrowRight size={15} />
          </button>
        </section>
        </div>
      </div>
      <div className="home-columns lower-panels grid grid-cols-[minmax(0,1.65fr)_minmax(255px,.9fr)] items-start gap-[14px] max-[760px]:grid-cols-1">
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">ACONTECEU POR AQUI</span>
              <h2>Últimas movimentações</h2>
            </div>
            <button className="text-action" onClick={() => onPage("movements")}>
              Ver todas <ArrowRight size={15} />
            </button>
          </div>
          <MovementList
            movements={movements.slice(0, 5)}
            accounts={accounts}
            compact
          />
        </section>
        <section className="panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">EM UM SÓ LUGAR</span>
              <h2>Suas contas</h2>
            </div>
            <button
              className="icon-btn"
              title="Ver contas"
              aria-label="Ver contas"
              onClick={() => onPage("accounts")}
            >
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="mini-accounts">
            {accounts.slice(0, 3).map((a) => (
              <AccountRow key={a.id} account={a} balance={accountBalance(a)} />
            ))}
          </div>
          <button
            className="add-account-link"
            onClick={() => onPage("accounts")}
          >
            <CirclePlus size={16} /> Gerenciar contas
          </button>
        </section>
      </div>
      <div className="gentle-note">
        <span>✳</span>
        <p>
          <b>Um lembrete gentil:</b> organização não é sobre ter muito. É sobre
          saber para onde vai o que você tem.
        </p>
        <button onClick={() => onPage("help")}>
          Preciso de uma ideia <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
