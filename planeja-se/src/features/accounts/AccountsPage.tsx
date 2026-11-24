import { useState } from 'react';
import { ArrowRight, CalendarRange, Landmark, MoreHorizontal, Plus, ShieldCheck, Wallet } from 'lucide-react';
import type { Account, Movement } from '../finance/model';
import { Heading, MovementList } from '../../components/finance';
import { ModalFrame } from '../../components/finance';
import { isoDate, maskCurrency, money, parseCurrency, toTitleCase } from '../finance/model';

type Period = "30d" | "month" | "90d" | "all" | "custom";
const PERIODS: { id: Period; label: string }[] = [
  { id: "month", label: "Este mês" },
  { id: "30d", label: "30 dias" },
  { id: "90d", label: "90 dias" },
  { id: "all", label: "Tudo" },
  { id: "custom", label: "Período" },
];

function periodRange(period: Period, from: string, to: string): [string, string] {
  if (period === "custom") return [from || "0000-01-01", to || "9999-12-31"];
  if (period === "all") return ["0000-01-01", "9999-12-31"];
  if (period === "month") return [`${isoDate().slice(0, 7)}-01`, "9999-12-31"];
  return [isoDate(period === "30d" ? 29 : 89), "9999-12-31"];
}

export function AccountsPage({
  accounts,
  movements,
  accountBalance,
  onAdd,
  onOpen,
}: {
  accounts: Account[];
  movements: Movement[];
  accountBalance: (a: Account) => number;
  onAdd: () => void;
  onOpen: (movement: Movement) => void;
}) {
  const [selected, setSelected] = useState("all");
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const current = accounts.find((a) => a.id === selected);
  const [start, end] = periodRange(period, from, to);
  // Extrato em ordem cronológica, filtrado por conta e período (HU05).
  const visible = movements.filter(
    (m) => (selected === "all" || m.account === selected) && m.date >= start && m.date <= end,
  );
  // Contas agrupadas por tipo (HU04).
  const groups = [...new Set(accounts.map((a) => a.type))].map((type) => ({
    type,
    accounts: accounts.filter((a) => a.type === type),
  }));
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="SUAS CONTAS"
        title="Tudo no mesmo lugar."
        description="Um retrato claro de cada conta que faz parte da sua vida. Selecione uma conta para ver o extrato."
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
      {groups.map((group) => (
        <section className="account-group" key={group.type}>
          <header>
            <span className="eyebrow">{group.type.toUpperCase()}</span>
            <small>{money(group.accounts.reduce((s, a) => s + accountBalance(a), 0))}</small>
          </header>
          <div className="account-cards grid grid-cols-3 gap-3 max-[760px]:grid-cols-2 max-[480px]:grid-cols-1">
            {group.accounts.map((a) => (
              <button
                className={`account-card ${selected === a.id ? "account-selected" : ""}`}
                key={a.id}
                aria-pressed={selected === a.id}
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
                  <i>{selected === a.id ? "Extrato aberto" : "Ver extrato"}</i>
                </footer>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button className="add-account-card" onClick={onAdd}>
        <span>
          <Plus size={20} />
        </span>
        <b>Adicionar outra conta</b>
        <small>Conta, poupança ou cartão</small>
      </button>
      <section className="panel account-history">
        <div className="panel-title">
          <div>
            <span className="eyebrow">{current ? "EXTRATO DA CONTA" : "EXTRATO DE TODAS AS CONTAS"}</span>
            <h2>{current?.name ?? "Todas as contas"}</h2>
          </div>
          {current && (
            <span className="account-history-balance">
              Saldo atual <b>{money(accountBalance(current))}</b>
            </span>
          )}
        </div>
        <div className="statement-filters">
          <CalendarRange size={15} />
          <div className="segmented" role="group" aria-label="Período do extrato">
            {PERIODS.map((item) => (
              <button
                type="button"
                key={item.id}
                className={period === item.id ? "selected" : ""}
                aria-pressed={period === item.id}
                onClick={() => setPeriod(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <span className="date-range">
              <input type="date" aria-label="De" value={from} onChange={(e) => setFrom(e.target.value)} />
              <span>até</span>
              <input type="date" aria-label="Até" value={to} onChange={(e) => setTo(e.target.value)} />
            </span>
          )}
        </div>
        <MovementList movements={visible} accounts={accounts} onOpen={onOpen} />
      </section>
      <section className="privacy-note">
        <ShieldCheck size={18} />
        <span>
          <b>Seus dados estão sob seu controle.</b>
          <small>
            Os dados ficam no servidor do Planeja-se, acessíveis só com o seu login. Não há conexão
            bancária automática: os saldos vêm do que você registra.
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
            name: toTitleCase(name),
            bank: toTitleCase(bank),
            type,
            opening: parseCurrency(opening),
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
                setOpening(maskCurrency(e.target.value, true))
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
