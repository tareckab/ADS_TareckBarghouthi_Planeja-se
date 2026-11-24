import { useState } from 'react';
import { ArrowRight, CirclePlus, Goal, Plus, Sparkles, Target, Trash2 } from 'lucide-react';
import type { Budget, Category, Goal as SavingGoal, Kind, Summary } from '../finance/model';
import { maskCurrency, money, parseCurrency, toTitleCase } from '../finance/model';
import { Heading, ModalFrame, Progress } from '../../components/finance';
import type { BudgetInput } from '../finance/api';

const monthName = (month: string) =>
  new Date(`${month}-01T12:00:00`).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

function BudgetRow({ budget, onDelete }: { budget: Budget; onDelete: () => void }) {
  const expense = budget.kind === "expense";
  const over = expense && budget.achieved >= budget.amount;
  return (
    <li className={`budget-row ${over ? "is-over" : ""}`}>
      <div className="budget-row-head">
        <span>
          <small>{expense ? "META DE GASTO" : "META DE FATURAMENTO"}</small>
          <b>{budget.category ?? "Todo o espaço"}</b>
        </span>
        <strong>{Math.round(budget.percent)}%</strong>
        <button type="button" className="icon-btn" aria-label={`Remover meta ${budget.category ?? "geral"}`} title="Remover meta" onClick={onDelete}>
          <Trash2 size={15} />
        </button>
      </div>
      <Progress value={budget.achieved} max={budget.amount} />
      <p>
        {money(budget.achieved)} de {money(budget.amount)}
        {budget.pending > 0 && <> · {money(budget.pending)} pendente</>}
        {over
          ? <b> · Limite ultrapassado em {money(budget.achieved - budget.amount)}</b>
          : expense
            ? <> · restam {money(budget.amount - budget.achieved)}</>
            : budget.achieved >= budget.amount ? <b className="ok"> · Meta alcançada</b> : <> · faltam {money(budget.amount - budget.achieved)}</>}
      </p>
    </li>
  );
}

export function GoalsPage({
  goals,
  summary,
  onAdd,
  onDeposit,
  onAddBudget,
  onDeleteBudget,
}: {
  goals: SavingGoal[];
  summary: Summary | null;
  onAdd: () => void;
  onDeposit: (id: string) => void;
  onAddBudget: () => void;
  onDeleteBudget: (id: string) => void;
}) {
  const budgets = summary?.budgets ?? [];
  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="SEUS PLANOS MERECEM ESPAÇO"
        title="O que você quer realizar?"
        description="Defina limites de gasto e alvos de faturamento para o mês e acompanhe seus objetivos de economia."
        action={
          <button className="button-primary" onClick={onAddBudget}>
            <Target size={17} /> Definir meta do mês
          </button>
        }
      />
      <section className="panel budgets-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">METAS DE {summary ? monthName(summary.month).toUpperCase() : "DO MÊS"}</span>
            <h2>Gastos e faturamento do mês</h2>
          </div>
          <button className="text-action" onClick={onAddBudget}>
            <Plus size={15} /> Nova meta mensal
          </button>
        </div>
        {budgets.length ? (
          <ul className="budget-list">
            {budgets.map((budget) => (
              <BudgetRow key={budget.id} budget={budget} onDelete={() => onDeleteBudget(budget.id)} />
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <Target size={22} />
            <b>Nenhuma meta para este mês</b>
            <span>Defina um limite de gasto (geral ou por categoria) para receber a recomendação de quanto ainda pode gastar.</span>
          </div>
        )}
        <small className="panel-note">
          O percentual considera lançamentos confirmados. Pendentes aparecem à parte e entram na recomendação de gasto.
        </small>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">OBJETIVOS DE ECONOMIA</span>
          <h2>Seus planos</h2>
        </div>
        <button className="text-action" onClick={onAdd}>
          <Plus size={15} /> Novo objetivo
        </button>
      </div>
      <section className="goal-overview">
        <Sparkles size={20} />
        <span>
          <small>SEU PROGRESSO JUNTOS</small>
          <b>
            {money(saved)} <i>de {money(target)}</i>
          </b>
          <small>guardados em {goals.length} planos</small>
        </span>
        <div>
          <b>{target ? Math.round((saved / target) * 100) : 0}%</b>
          <Progress value={saved} max={target || 1} />
        </div>
      </section>
      <div className="goal-cards grid grid-cols-3 gap-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
        {goals.map((g) => (
          <article className="goal-card" key={g.id}>
            <span className={`goal-icon ${g.color}`}>
              <Goal size={18} />
            </span>
            <small>OBJETIVO</small>
            <h2>{g.title}</h2>
            <div className="goal-card-amount">
              <b>{money(g.saved)}</b>
              <span>de {money(g.target)}</span>
            </div>
            <Progress value={g.saved} max={g.target} />
            <footer>
              <span>{Math.round((g.saved / g.target) * 100)}% concluído</span>
              <span>Faltam {money(Math.max(0, g.target - g.saved))}</span>
            </footer>
            <button className="text-action" onClick={() => onDeposit(g.id)}>
              Adicionar aporte <ArrowRight size={15} />
            </button>
          </article>
        ))}
        <button className="new-goal-card" onClick={onAdd}>
          <CirclePlus size={22} />
          <b>Tem um novo plano?</b>
          <small>Crie um objetivo e acompanhe cada aporte.</small>
        </button>
      </div>
      <div className="gentle-note">
        <span>✳</span>
        <p>
          <b>Sem pressa.</b> Uma meta não precisa ser grande para ser
          importante.
        </p>
      </div>
    </div>
  );
}

export function GoalFormModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (g: Omit<SavingGoal, "id" | "saved">) => void;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  return (
    <ModalFrame
      title="Um novo objetivo"
      description="Algo para juntar dinheiro aos poucos, com aportes."
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            title: toTitleCase(title),
            target: parseCurrency(target),
            color: ["green", "blue", "orange"][Math.floor(Math.random() * 3)],
          });
        }}
      >
        <label className="form-label">
          O que você quer realizar?
          <input
            autoFocus
            placeholder="Ex.: viagem, reserva, curso..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          Quanto você quer juntar? (R$)
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={target}
            onChange={(e) => setTarget(maskCurrency(e.target.value))}
            required
          />
        </label>
        <div className="form-footer">
          <span>Seu próximo passo, no seu ritmo.</span>
          <button
            className="button-primary"
            disabled={!title.trim() || parseCurrency(target) <= 0}
          >
            Criar objetivo <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

export function GoalDepositModal({
  goal,
  onClose,
  onSave,
}: {
  goal?: SavingGoal;
  onClose: () => void;
  onSave: (amount: number) => void;
}) {
  const [amount, setAmount] = useState("");
  return (
    <ModalFrame
      title="Adicionar à meta"
      description={goal?.title ?? ""}
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave(parseCurrency(amount));
        }}
      >
        <label className="form-label">
          Valor do aporte (R$)
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(maskCurrency(e.target.value))}
            required
          />
        </label>
        <div className="form-footer">
          <span>Atualiza o progresso desta meta.</span>
          <button
            className="button-primary"
            disabled={parseCurrency(amount) <= 0}
          >
            Adicionar aporte <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

/** Define (ou atualiza) a meta mensal de gasto ou faturamento — HU06. */
export function BudgetFormModal({
  categories,
  budgets,
  month,
  onClose,
  onSave,
}: {
  categories: Category[];
  budgets: Budget[];
  month: string;
  onClose: () => void;
  onSave: (budget: BudgetInput) => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [categoryId, setCategoryId] = useState("");
  const [amount, setAmount] = useState("");
  const existing = budgets.find((b) => b.kind === kind && (b.categoryId ?? "") === categoryId);
  return (
    <ModalFrame
      title="Meta do mês"
      description={`Vale para ${monthName(month)}. Uma meta por categoria e tipo; salvar de novo atualiza o valor.`}
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({ month, kind, categoryId: categoryId || null, amount: parseCurrency(amount) });
        }}
      >
        <div className="segmented type-switch" role="group" aria-label="Tipo de meta">
          {(["expense", "income"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={kind === item ? "selected" : ""}
              aria-pressed={kind === item}
              onClick={() => {
                setKind(item);
                setCategoryId("");
              }}
            >
              {item === "expense" ? "Limite de gasto" : "Meta de faturamento"}
            </button>
          ))}
        </div>
        <label className="form-label">
          Aplicar a
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Todo o espaço ({kind === "expense" ? "todas as saídas" : "todas as entradas"})</option>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="form-label">
          {kind === "expense" ? "Quanto pode gastar no mês? (R$)" : "Quanto quer faturar no mês? (R$)"}
          <input
            autoFocus
            inputMode="decimal"
            placeholder={existing ? maskCurrency(String(Math.round(existing.amount * 100))) : "0,00"}
            value={amount}
            onChange={(e) => setAmount(maskCurrency(e.target.value))}
            required
          />
        </label>
        {existing && (
          <p className="spending-hint">
            Já existe uma meta de {money(existing.amount)} para esta opção. Salvar substitui o valor.
          </p>
        )}
        <div className="form-footer">
          <span>Metas de meses encerrados ficam só para consulta.</span>
          <button className="button-primary" disabled={parseCurrency(amount) <= 0}>
            {existing ? "Atualizar meta" : "Salvar meta"} <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
