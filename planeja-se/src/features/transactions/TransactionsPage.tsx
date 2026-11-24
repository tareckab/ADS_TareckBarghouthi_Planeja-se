import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Ban, Check, ChevronDown, CircleCheck, Clock3, FileText, Filter, ImagePlus, Lightbulb, Plus, Search, ShieldCheck, Tags, Upload } from 'lucide-react';
import type { Account, Activity, Category, Kind, Movement, MovementInput, MovementStatus, Priority, Recommendation } from '../finance/model';
import { isoDate, maskCurrency, money, parseCurrency, PRIORITY_LABEL, STATUS_LABEL, toTitleCase } from '../finance/model';
import { Heading, ModalFrame, MovementList } from '../../components/finance';
import { normalize, parseReceipt, type ReceiptField } from './receiptParser';
import { readReceiptText } from './receiptReader';

const FIELD_LABELS: Record<ReceiptField, string> = {
  amount: 'valor',
  date: 'data',
  title: 'descrição',
  category: 'categoria',
  account: 'conta',
  kind: 'tipo',
};

export function TransactionsPage({
  movements,
  accounts,
  search,
  setSearch,
  kind,
  setKind,
  account,
  setAccount,
  status,
  setStatus,
  activity,
  onAdd,
  onOpen,
  onCategories,
}: {
  movements: Movement[];
  accounts: Account[];
  search: string;
  setSearch: (v: string) => void;
  kind: "all" | Kind;
  setKind: (v: "all" | Kind) => void;
  account: string;
  setAccount: (v: string) => void;
  status: "all" | MovementStatus;
  setStatus: (v: "all" | MovementStatus) => void;
  activity: Activity[];
  onAdd: () => void;
  onOpen: (movement: Movement) => void;
  onCategories: () => void;
}) {
  return (
    <div className="page-content grid gap-10 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="MOVIMENTAÇÕES"
        title="Cada detalhe conta."
        description="Acompanhe entradas e saídas, sem perder o fio da meada. Toque em um lançamento para editar, confirmar ou cancelar."
        action={
          <div className="heading-actions">
            <button className="button-secondary" onClick={onCategories}>
              <Tags size={16} /> Categorias
            </button>
            <button className="button-primary" onClick={onAdd}>
              <Plus size={17} /> Novo lançamento
            </button>
          </div>
        }
      />
      <section className="panel list-panel p-2.5 min-w-0 rounded-md border border-[#e8ece6] bg-white ">
        <div className="movement-tools">
          <label className="search-box">
            <Search size={16} />
            <input
              placeholder="Buscar movimentação"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="filter-box">
            <Filter size={15} />
            <select
              aria-label="Filtrar por conta"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              <option value="all">Todas as contas</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <label className="filter-box">
            <Clock3 size={15} />
            <select
              aria-label="Filtrar por status"
              value={status}
              onChange={(e) => setStatus(e.target.value as "all" | MovementStatus)}
            >
              <option value="all">Todos os status</option>
              {(Object.keys(STATUS_LABEL) as MovementStatus[]).map((item) => (
                <option key={item} value={item}>
                  {STATUS_LABEL[item]}s
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
          <div className="segmented">
            {(["all", "income", "expense"] as const).map((item) => (
              <button
                key={item}
                className={kind === item ? "selected" : ""}
                onClick={() => setKind(item)}
              >
                {item === "all"
                  ? "Todas"
                  : item === "income"
                    ? "Entradas"
                    : "Saídas"}
              </button>
            ))}
          </div>
        </div>
        <div className="table-labels">
          <span>DESCRIÇÃO</span>
          <span>DATA</span>
          <span>VALOR</span>
        </div>
        <MovementList movements={movements} accounts={accounts} onOpen={onOpen} />
        {!movements.length && (
          <div className="list-footer">
            Ajuste os filtros ou registre um lançamento.
          </div>
        )}
      </section>
      <section className="panel log-panel grid min-w-0 gap-0 rounded-md border border-[#e8ece6] bg-white p-[18px]">
        <div className="panel-title">
          <div>
            <span className="eyebrow">RASTREABILIDADE</span>
            <h2>Registro de atualizações</h2>
          </div>
          <span className="log-count">
            <Clock3 size={14} /> {activity.length} registros
          </span>
        </div>
        {activity.map((item) => (
          <div className="log-row" key={item.id}>
            <span>
              <Check size={14} />
            </span>
            <div>
              <b>{item.title}</b>
              <small>
                {item.detail}
                {item.author ? ` · por ${item.author}` : ""}
              </small>
            </div>
            <time>{item.date}</time>
          </div>
        ))}
      </section>
    </div>
  );
}

/** Categoria padrão de um tipo: "Outros", ou a primeira disponível. */
const defaultCategory = (categories: Category[], kind: Kind) =>
  (categories.find((c) => c.kind === kind && c.name === "Outros") ?? categories.find((c) => c.kind === kind))?.id ?? "";

function SpendingHint({ recommendation, amount }: { recommendation?: Recommendation; amount: number }) {
  if (!recommendation) return null;
  if (recommendation.status === "no-budget")
    return (
      <p className="spending-hint">
        <Lightbulb size={15} /> Defina uma meta de gasto do mês em <b>Metas e objetivos</b> para ver quanto ainda pode gastar.
      </p>
    );
  const remaining = Math.max(0, recommendation.remaining);
  const over = amount > remaining;
  return (
    <p className={`spending-hint ${over || recommendation.status === "exceeded" ? "is-over" : ""}`}>
      <Lightbulb size={15} />
      {recommendation.status === "exceeded"
        ? <>A meta de gasto do mês já foi ultrapassada em <b>{money(-recommendation.remaining)}</b>.</>
        : over
          ? <>Este valor passa do que resta na meta do mês (<b>{money(remaining)}</b>).</>
          : <>Você ainda pode gastar <b>{money(recommendation.dailyAllowance)}</b> por dia, <b>{money(remaining)}</b> até o fim do mês.</>}
    </p>
  );
}

export function MovementFormModal({
  accounts,
  categories,
  movement,
  recommendation,
  onClose,
  onSave,
  onStatus,
}: {
  accounts: Account[];
  categories: Category[];
  /** Lançamento existente: o formulário abre em modo de edição. */
  movement?: Movement;
  recommendation?: Recommendation;
  onClose: () => void;
  onSave: (m: MovementInput) => void;
  onStatus: (status: MovementStatus) => void;
}) {
  const editing = Boolean(movement);
  const locked = movement?.status === "cancelled";
  const [kind, setKind] = useState<Kind>(movement?.kind ?? "expense");
  const [title, setTitle] = useState(movement?.title ?? "");
  const [amount, setAmount] = useState(
    movement ? maskCurrency(String(Math.round(movement.amount * 100))) : "",
  );
  const [categoryId, setCategoryId] = useState(movement?.categoryId ?? defaultCategory(categories, "expense"));
  const [date, setDate] = useState(movement?.date ?? isoDate());
  const [account, setAccount] = useState(movement?.account ?? accounts[0]?.id ?? "");
  const [status, setStatus] = useState<MovementStatus>(movement?.status ?? "confirmed");
  const [priority, setPriority] = useState<Priority>(movement?.priority ?? "normal");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const [reading, setReading] = useState(false);
  // Campos preenchidos pelo comprovante: ficam destacados até o usuário editá-los.
  const [auto, setAuto] = useState<Set<ReceiptField>>(new Set());
  const touched = (field: ReceiptField) =>
    setAuto((current) => {
      if (!current.has(field)) return current;
      const next = new Set(current);
      next.delete(field);
      return next;
    });
  const autoClass = (field: ReceiptField) => (auto.has(field) ? "is-auto" : undefined);
  const kindCategories = categories.filter((c) => c.kind === kind);

  const changeKind = (next: Kind) => {
    setKind(next);
    touched("kind");
    if (categories.find((c) => c.id === categoryId)?.kind !== next) {
      // Mantém a categoria de mesmo nome no outro tipo, se existir (ex.: "Serviços").
      const currentName = categories.find((c) => c.id === categoryId)?.name;
      setCategoryId(
        categories.find((c) => c.kind === next && c.name === currentName)?.id ?? defaultCategory(categories, next),
      );
    }
  };

  const processReceipt = async (file?: File) => {
    if (!file || reading) return;
    setReading(true);
    setOcrText("");
    setAuto(new Set());
    try {
      const { text, source } = await readReceiptText(file, setOcrStatus);
      setOcrText(text.trim());
      const found = parseReceipt(text, accounts);
      const nextKind = found.kind ?? kind;
      if (found.kind) setKind(found.kind);
      if (found.amount !== undefined)
        setAmount(maskCurrency(String(Math.round(found.amount * 100))));
      if (found.date) setDate(found.date);
      if (found.title) setTitle(toTitleCase(found.title).slice(0, 160));
      // A categoria sugerida só é usada se existir no espaço para o tipo do lançamento.
      const matched = found.category
        ? categories.find((c) => c.kind === nextKind && normalize(c.name) === normalize(found.category!))
        : undefined;
      if (matched) setCategoryId(matched.id);
      else if (found.kind) setCategoryId(defaultCategory(categories, found.kind));
      if (found.accountId) setAccount(found.accountId);
      const recognized = found.found.filter((field) => field !== "category" || matched);
      setAuto(new Set(recognized));
      const missing = (["amount", "date", "title", "category", "account"] as const)
        .filter((field) => !recognized.includes(field))
        .map((field) => FIELD_LABELS[field]);
      const origin = source === "pdf" ? "PDF lido" : "Imagem lida";
      setOcrStatus(
        !text.trim()
          ? "Texto não identificado. Você pode preencher manualmente."
          : recognized.length === 0
            ? `${origin}, mas nenhum campo foi reconhecido. Preencha manualmente.`
            : `${origin}. Confira os campos destacados antes de salvar.${missing.length ? ` Não encontrado: ${missing.join(", ")}.` : ""}`,
      );
    } catch (error) {
      setOcrStatus(
        error instanceof Error && /10 MB|Formato/.test(error.message)
          ? error.message
          : "Não foi possível ler este arquivo. Preencha manualmente.",
      );
    } finally {
      setReading(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (locked) return;
    onSave({
      title: toTitleCase(title),
      amount: parseCurrency(amount),
      categoryId,
      date,
      account,
      kind,
      status,
      priority,
    });
  };
  return (
    <ModalFrame
      title={editing ? "Editar lançamento" : "Novo lançamento"}
      description={
        locked
          ? "Lançamento cancelado (estornado): não entra nos saldos e não pode ser alterado."
          : editing
            ? "Altere os dados, confirme o pagamento ou cancele o lançamento."
            : "Registre uma entrada ou uma saída."
      }
      onClose={onClose}
      wide
    >
      <form className="form-body" onSubmit={submit}>
        <fieldset className="form-fieldset" disabled={locked}>
          <div className="form-row-between">
            <div className={`segmented type-switch ${autoClass("kind") ?? ""}`}>
              <button
                type="button"
                className={kind === "expense" ? "selected" : ""}
                onClick={() => changeKind("expense")}
              >
                <ArrowUpRight size={15} /> Saída
              </button>
              <button
                type="button"
                className={kind === "income" ? "selected" : ""}
                onClick={() => changeKind("income")}
              >
                <ArrowDownLeft size={15} /> Entrada
              </button>
            </div>
            {editing ? (
              <span className={`status-tag large ${status}`}>{STATUS_LABEL[status]}</span>
            ) : (
              <div className="segmented" role="group" aria-label="Status do lançamento">
                {(["confirmed", "pending"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={status === item ? "selected" : ""}
                    aria-pressed={status === item}
                    onClick={() => setStatus(item)}
                  >
                    {item === "confirmed" ? (kind === "income" ? "Já recebido" : "Já pago") : "Pendente"}
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="form-label">
            Descrição
            <input
              autoFocus={!editing}
              className={autoClass("title")}
              placeholder="Ex.: mercado, salário, aluguel..."
              value={title}
              maxLength={160}
              onChange={(e) => {
                setTitle(e.target.value);
                touched("title");
              }}
              required
            />
          </label>
          <div className="form-grid">
            <label className="form-label">
              Valor (R$)
              <input
                inputMode="decimal"
                className={autoClass("amount")}
                placeholder="0,00"
                value={amount}
                onChange={(e) => {
                  setAmount(maskCurrency(e.target.value));
                  touched("amount");
                }}
                required
              />
            </label>
            <label className="form-label">
              Categoria
              <select
                className={autoClass("category")}
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  touched("category");
                }}
                required
              >
                {kindCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid">
            <label className="form-label">
              {status === "pending" ? "Vencimento / previsão" : "Data"}
              <input
                type="date"
                className={autoClass("date")}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  touched("date");
                }}
                required
              />
            </label>
            <label className="form-label">
              Conta
              <select
                className={autoClass("account")}
                value={account}
                onChange={(e) => {
                  setAccount(e.target.value);
                  touched("account");
                }}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} · {a.bank}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="form-label">
            Prioridade
            <select value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
              {(Object.keys(PRIORITY_LABEL) as Priority[]).map((item) => (
                <option key={item} value={item}>
                  {PRIORITY_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          {kind === "expense" && !locked && (
            <SpendingHint recommendation={recommendation} amount={editing ? 0 : parseCurrency(amount)} />
          )}
          {!editing && (
            <div className="ocr-box" aria-busy={reading}>
              <input
                id="ocr-file"
                type="file"
                accept="image/*,application/pdf,.pdf"
                disabled={reading}
                onChange={(e) => {
                  void processReceipt(e.target.files?.[0]);
                  e.target.value = ""; // permite anexar o mesmo arquivo de novo
                }}
              />
              <label htmlFor="ocr-file">
                <ImagePlus size={18} />
                <span>
                  <b>{reading ? "Lendo comprovante..." : "Preencher com nota ou comprovante"}</b>
                  <small>Imagem ou PDF · lido no seu dispositivo, nada é enviado</small>
                </span>
                <Upload size={16} />
              </label>
              {ocrStatus && <p>{ocrStatus}</p>}
              {ocrText && (
                <details>
                  <summary>
                    <FileText size={14} /> Texto reconhecido{" "}
                    <ChevronDown size={14} />
                  </summary>
                  <pre>{ocrText}</pre>
                </details>
              )}
            </div>
          )}
        </fieldset>
        {editing && !locked && (
          <div className="status-actions">
            {movement?.status === "pending" && (
              <button type="button" className="button-secondary" onClick={() => onStatus("confirmed")}>
                <CircleCheck size={15} /> {kind === "income" ? "Confirmar recebimento" : "Confirmar pagamento"}
              </button>
            )}
            {confirmCancel ? (
              <span className="confirm-inline" role="alert">
                Cancelar este lançamento? Ele sai dos saldos e não poderá ser reaberto.
                <button type="button" className="button-danger" onClick={() => onStatus("cancelled")}>
                  Sim, cancelar
                </button>
                <button type="button" className="text-action" onClick={() => setConfirmCancel(false)}>
                  Voltar
                </button>
              </span>
            ) : (
              <button type="button" className="text-action danger" onClick={() => setConfirmCancel(true)}>
                <Ban size={15} /> Cancelar lançamento (estorno)
              </button>
            )}
          </div>
        )}
        <footer className="form-footer">
          <span>
            <ShieldCheck size={14} /> Confira os dados antes de registrar
          </span>
          {locked ? (
            <button type="button" className="button-primary" onClick={onClose}>
              Fechar
            </button>
          ) : (
            <button
              className="button-primary"
              disabled={!title.trim() || parseCurrency(amount) <= 0 || !account || !categoryId}
            >
              {editing ? "Salvar alterações" : "Registrar lançamento"} <ArrowRight size={15} />
            </button>
          )}
        </footer>
      </form>
    </ModalFrame>
  );
}
