import type { ReactNode } from 'react';
import { ArrowDownLeft, ArrowLeftRight, Banknote, CreditCard, Landmark, MoreHorizontal, X } from 'lucide-react';
import type { Account, Movement } from '../features/finance/model';
import { dateLabel, money } from '../features/finance/model';

export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading mb-0 flex items-end justify-between gap-5 max-[760px]:items-start max-[760px]:flex-col max-[760px]:gap-2.5">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, max }: { value: number; max: number }) {
  return (
    <div className="progress-track h-1.5 overflow-hidden rounded-full bg-[#e9eee8]">
      <i style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

export function MovementList({
  movements,
  accounts,
  compact = false,
}: {
  movements: Movement[];
  accounts: Account[];
  compact?: boolean;
}) {
  if (!movements.length)
    return (
      <div className="empty-state">
        <ArrowLeftRight size={22} />
        <b>Nenhuma movimentação por aqui</b>
        <span>Registre sua primeira entrada ou saída.</span>
      </div>
    );
  return (
    <div className="movement-list w-full">
      {movements.map((m) => (
        <div className="movement-row" key={m.id}>
          <span className={`movement-icon ${m.kind}`}>
            {/renda|serviços/i.test(m.category) ? (
              <ArrowDownLeft size={17} />
            ) : /moradia/i.test(m.category) ? (
              <Landmark size={17} />
            ) : /alimentação/i.test(m.category) ? (
              <Banknote size={17} />
            ) : (
              <CreditCard size={17} />
            )}
          </span>
          <span className="movement-copy">
            <b>{m.title}</b>
            <small>
              {m.category}
              {!compact
                ? ` · ${accounts.find((a) => a.id === m.account)?.name ?? "Conta"}`
                : ""}
            </small>
          </span>
          <span className="movement-date">{dateLabel(m.date)}</span>
          <b className={`movement-value ${m.kind}`}>
            {m.kind === "income" ? "+" : "−"}
            {money(m.amount)}
          </b>
        </div>
      ))}
    </div>
  );
}

export function AccountRow({
  account,
  balance,
}: {
  account: Account;
  balance: number;
}) {
  return (
    <div className="account-row flex min-h-[58px] items-center gap-2 border-t border-[#eff1ee]">
      <span className={`bank-symbol ${account.color}`}>
        <Landmark size={16} />
      </span>
      <span className="account-copy">
        <b>{account.name}</b>
        <small>
          {account.bank} · {account.type}
        </small>
      </span>
      <strong>{money(balance)}</strong>
      <button
        className="icon-btn row-more"
        title="Opções"
        aria-label={`Opções de ${account.name}`}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}

export function ModalFrame({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className={`dialog max-h-[90vh] w-full max-w-[450px] overflow-auto rounded-lg bg-white shadow-2xl ${wide ? "dialog-wide max-w-[570px]" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <header>
          <div>
            <span className="eyebrow">PLANEJA-SE</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
