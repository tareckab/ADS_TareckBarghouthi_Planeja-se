import { useState } from 'react';
import { ArrowRight, Landmark, MoreHorizontal, Plus, ShieldCheck, Wallet } from 'lucide-react';
import type { Account, Movement } from '../finance/model';
import { Heading, MovementList } from '../../components/finance';
import { ModalFrame } from '../../components/finance';
import { money } from '../finance/model';

export function AccountsPage({
  accounts,
  movements,
  accountBalance,
  onAdd,
}: {
  accounts: Account[];
  movements: Movement[];
  accountBalance: (a: Account) => number;
  onAdd: () => void;
}) {
  const [selected, setSelected] = useState("all");
  const current = accounts.find((a) => a.id === selected);
  const visible =
    selected === "all"
      ? movements
      : movements.filter((m) => m.account === selected);
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="SUAS CONTAS"
        title="Tudo no mesmo lugar."
        description="Um retrato claro de cada conta que faz parte da sua vida."
        action={
          <button className="button-primary" onClick={onAdd}>
            <Plus size={17} /> Adicionar conta
          </button>
        }
      />
      <div className="account-summary">
        <span className="metric-icon saved-icon">
          <Wallet size={18} />
        </span>
        <span>
          <small>SALDO CONSOLIDADO</small>
          <b>{money(accounts.reduce((s, a) => s + accountBalance(a), 0))}</b>
        </span>
        <i>{accounts.length} contas registradas</i>
      </div>
      <div className="account-cards grid grid-cols-3 gap-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
        {accounts.map((a, i) => (
          <button
            className={`account-card ${selected === a.id ? "account-selected" : ""}`}
            key={a.id}
            onClick={() => setSelected(selected === a.id ? "all" : a.id)}
          >
            <div>
              <span className={`bank-symbol large ${a.color}`}>
                <Landmark size={19} />
              </span>
              <MoreHorizontal size={18} />
            </div>
            <small>
              {a.bank} · {a.type}
            </small>
            <h2>{a.name}</h2>
            <strong>{money(accountBalance(a))}</strong>
            <footer>
              {movements.filter((m) => m.account === a.id).length} movimentações{" "}
              <i>{i === 0 ? "Principal" : "Ativa"}</i>
            </footer>
          </button>
        ))}
        <button className="add-account-card" onClick={onAdd}>
          <span>
            <Plus size={20} />
          </span>
          <b>Adicionar outra conta</b>
          <small>Conta, poupança ou cartão</small>
        </button>
      </div>
      {current && (
        <section className="panel account-history">
          <div className="panel-title">
            <div>
              <span className="eyebrow">EXTRATO DA CONTA</span>
              <h2>{current.name}</h2>
            </div>
            <span className="account-history-balance">
              Saldo atual <b>{money(accountBalance(current))}</b>
            </span>
          </div>
          <MovementList movements={visible} accounts={accounts} />
        </section>
      )}
      <section className="privacy-note">
        <ShieldCheck size={18} />
        <span>
          <b>Seus dados estão sob seu controle.</b>
          <small>
            Este MVP guarda os dados apenas neste navegador. Não há conexão
            bancária automática.
          </small>
        </span>
      </section>
    </div>
  );
}

export function AccountFormModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (a: Omit<Account, "id">) => void;
}) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [type, setType] = useState("Conta corrente");
  const [opening, setOpening] = useState("");
  return (
    <ModalFrame
      title="Adicionar conta"
      description="Tenha uma visão completa do seu dinheiro."
      onClose={onClose}
    >
      <form
        className="form-body"
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            name: name.trim(),
            bank: bank.trim(),
            type,
            opening: Number(opening.replace(",", ".")) || 0,
            color: ["lavender", "mint", "peach"][Math.floor(Math.random() * 3)],
          });
        }}
      >
        <label className="form-label">
          Nome da conta
          <input
            autoFocus
            placeholder="Ex.: Conta do dia a dia"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="form-label">
          Banco ou instituição
          <input
            placeholder="Ex.: Nubank"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            required
          />
        </label>
        <div className="form-grid">
          <label className="form-label">
            Tipo
            <select value={type} onChange={(e) => setType(e.target.value)}>
              {[
                "Conta corrente",
                "Poupança",
                "Investimento",
                "Cartão",
                "Dinheiro",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="form-label">
            Saldo inicial
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={opening}
              onChange={(e) =>
                setOpening(e.target.value.replace(/[^\d,.\-]/g, ""))
              }
            />
          </label>
        </div>
        <div className="form-footer">
          <span>Sem conexão bancária automática</span>
          <button
            className="button-primary"
            disabled={!name.trim() || !bank.trim()}
          >
            Adicionar conta <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
