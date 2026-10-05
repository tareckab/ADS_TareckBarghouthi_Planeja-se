import { useState } from 'react';
import { ArrowRight, CirclePlus, Goal, Plus, Sparkles } from 'lucide-react';
import type { Goal as SavingGoal } from '../finance/model';
import { money } from '../finance/model';
import { Heading, ModalFrame, Progress } from '../../components/finance';

export function GoalsPage({
  goals,
  onAdd,
  onDeposit,
}: {
  goals: SavingGoal[];
  onAdd: () => void;
  onDeposit: (id: string) => void;
}) {
  const saved = goals.reduce((s, g) => s + g.saved, 0);
  const target = goals.reduce((s, g) => s + g.target, 0);
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="SEUS PLANOS MERECEM ESPAÇO"
        title="O que você quer realizar?"
        description="Transforme vontades em metas possíveis, no seu ritmo."
        action={
          <button className="button-primary" onClick={onAdd}>
            <Plus size={17} /> Nova meta
          </button>
        }
      />
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
            <small>META FINANCEIRA</small>
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
          <small>Crie uma meta e acompanhe cada conquista.</small>
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
      title="Uma nova meta"
      description="Escolha algo que faça sentido para você."
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            title: title.trim(),
            target: Number(target.replace(",", ".")),
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
            onChange={(e) => setTarget(e.target.value.replace(/[^\d,.]/g, ""))}
            required
          />
        </label>
        <div className="form-footer">
          <span>Seu próximo passo, no seu ritmo.</span>
          <button
            className="button-primary"
            disabled={!title.trim() || Number(target.replace(",", ".")) <= 0}
          >
            Criar meta <ArrowRight size={15} />
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
          onSave(Number(amount.replace(",", ".")));
        }}
      >
        <label className="form-label">
          Valor do aporte (R$)
          <input
            autoFocus
            inputMode="decimal"
            placeholder="0,00"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ""))}
            required
          />
        </label>
        <div className="form-footer">
          <span>Atualiza o progresso desta meta.</span>
          <button
            className="button-primary"
            disabled={Number(amount.replace(",", ".")) <= 0}
          >
            Adicionar aporte <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
