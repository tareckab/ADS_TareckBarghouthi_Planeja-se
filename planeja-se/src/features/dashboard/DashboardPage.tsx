import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CirclePlus, Goal, PiggyBank, Plus, Wallet } from 'lucide-react';
import type { Account, Goal as SavingGoal, Movement, Page, Workspace } from '../finance/model';
import { AccountRow, Heading, MovementList, Progress } from '../../components/finance';
import { money } from '../finance/model';

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
  onAdd: () => void;
  onPage: (p: Page) => void;
}) {
  const daySpend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return movements
      .filter(
        (m) =>
          m.date === date.toISOString().slice(0, 10) && m.kind === "expense",
      )
      .reduce((s, m) => s + m.amount, 0);
  });
  const dayIncome = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 6 + i);
    return movements
      .filter(
        (m) =>
          m.date === date.toISOString().slice(0, 10) && m.kind === "income",
      )
      .reduce((s, m) => s + m.amount, 0);
  });
  const max = Math.max(...daySpend, ...dayIncome, 1);
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
        </article>
      </section>
      <div className="home-columns grid grid-cols-[minmax(0,1.65fr)_minmax(255px,.9fr)] gap-[14px] max-[760px]:grid-cols-1">
        <section className="panel cash-panel">
          <div className="panel-title">
            <div>
              <span className="eyebrow">SEU RITMO</span>
              <h2>Como o dinheiro se move</h2>
            </div>
            <span className="period-label">
              <CalendarDays size={14} /> Esta semana <ChevronDown size={14} />
            </span>
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
              <span>R$ 1.000</span>
              <span>R$ 500</span>
              <span>R$ 0</span>
            </div>
            <div className="week-chart">
              {daySpend.map((amount, i) => {
                const earnings = dayIncome[i];
                return (
                  <div className="chart-day" key={i}>
                    <div className="bars">
                      <i
                        className="bar-in"
                        style={{
                          height: `${Math.max(6, (earnings / max) * 74)}%`,
                        }}
                      />
                      <i
                        className="bar-out"
                        style={{
                          height: `${Math.max(4, (amount / max) * 74)}%`,
                        }}
                      />
                    </div>
                    <span>
                      {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"][i]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="chart-caption">
            <i /> Últimos 7 dias{" "}
            <b>· {money(daySpend.reduce((s, x) => s + x, 0))} em saídas</b>
          </div>
        </section>
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
