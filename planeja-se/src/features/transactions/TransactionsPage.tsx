import { useState, type FormEvent } from 'react';
import { createWorker } from 'tesseract.js';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Clock3, FileText, Filter, ImagePlus, Plus, Search, ShieldCheck, Upload } from 'lucide-react';
import type { Account, Activity, Kind, Movement } from '../finance/model';
import { isoDate } from '../finance/model';
import { Heading, ModalFrame, MovementList } from '../../components/finance';

export function TransactionsPage({
  movements,
  accounts,
  search,
  setSearch,
  kind,
  setKind,
  account,
  setAccount,
  activity,
  onAdd,
}: {
  movements: Movement[];
  accounts: Account[];
  search: string;
  setSearch: (v: string) => void;
  kind: "all" | Kind;
  setKind: (v: "all" | Kind) => void;
  account: string;
  setAccount: (v: string) => void;
  activity: Activity[];
  onAdd: () => void;
}) {
  return (
    <div className="page-content grid gap-5 max-[480px]:gap-[13px]">
      <Heading
        eyebrow="MOVIMENTAÇÕES"
        title="Cada detalhe conta."
        description="Acompanhe entradas e saídas, sem perder o fio da meada."
        action={
          <button className="button-primary" onClick={onAdd}>
            <Plus size={17} /> Novo lançamento
          </button>
        }
      />
      <section className="panel list-panel min-w-0 rounded-md border border-[#e8ece6] bg-white p-0">
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
        <MovementList movements={movements} accounts={accounts} />
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
              <small>{item.detail}</small>
            </div>
            <time>{item.date}</time>
          </div>
        ))}
      </section>
    </div>
  );
}

export function MovementFormModal({
  accounts,
  onClose,
  onSave,
}: {
  accounts: Account[];
  onClose: () => void;
  onSave: (m: Omit<Movement, "id">) => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [date, setDate] = useState(isoDate());
  const [account, setAccount] = useState(accounts[0]?.id ?? "");
  const [ocrText, setOcrText] = useState("");
  const [ocrStatus, setOcrStatus] = useState("");
  const processImage = async (file?: File) => {
    if (!file) return;
    setOcrStatus("Lendo imagem em português...");
    try {
      const worker = await createWorker("por", 1, {
        logger: (message) => {
          if (message.status === "recognizing text")
            setOcrStatus(
              `Reconhecendo texto: ${Math.round(message.progress * 100)}%`,
            );
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      setOcrText(data.text.trim());
      const candidates = Array.from(
        data.text.matchAll(
          /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2})/g,
        ),
      ).map((m) => m[1]);
      if (candidates.length)
        setAmount(candidates.at(-1)!.replaceAll(".", "").replace(",", "."));
      const firstLine = data.text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 3 && !/\d{2}[/.]\d{2}/.test(line));
      if (firstLine) setTitle(firstLine.slice(0, 60));
      setOcrStatus(
        data.text.trim()
          ? "Leitura concluída. Confira e corrija os campos antes de salvar."
          : "Texto não identificado. Você pode preencher manualmente.",
      );
    } catch {
      setOcrStatus("Não foi possível ler esta imagem. Preencha manualmente.");
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim(),
      amount: Number(amount.replace(",", ".")),
      category,
      date,
      account,
      kind,
    });
  };
  return (
    <ModalFrame
      title="Novo lançamento"
      description="Registre uma entrada ou uma saída."
      onClose={onClose}
      wide
    >
      <form className="form-body" onSubmit={submit}>
        <div className="segmented type-switch">
          <button
            type="button"
            className={kind === "expense" ? "selected" : ""}
            onClick={() => setKind("expense")}
          >
            <ArrowUpRight size={15} /> Saída
          </button>
          <button
            type="button"
            className={kind === "income" ? "selected" : ""}
            onClick={() => setKind("income")}
          >
            <ArrowDownLeft size={15} /> Entrada
          </button>
        </div>
        <label className="form-label">
          Descrição
          <input
            autoFocus
            placeholder="Ex.: mercado, salário, aluguel..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <div className="form-grid">
          <label className="form-label">
            Valor (R$)
            <input
              inputMode="decimal"
              placeholder="0,00"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value.replace(/[^\d,.]/g, ""))
              }
              required
            />
          </label>
          <label className="form-label">
            Categoria
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {[
                "Alimentação",
                "Moradia",
                "Transporte",
                "Saúde",
                "Lazer",
                "Renda",
                "Renda extra",
                "Serviços",
                "Operação",
                "Transferência",
                "Outros",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="form-label">
            Data
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            Conta
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.bank}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ocr-box">
          <input
            id="ocr-file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => void processImage(e.target.files?.[0])}
          />
          <label htmlFor="ocr-file">
            <ImagePlus size={18} />
            <span>
              <b>Preencher com imagem de extrato</b>
              <small>JPG ou PNG · leitura em português no dispositivo</small>
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
        <footer className="form-footer">
          <span>
            <ShieldCheck size={14} /> Confira os dados antes de registrar
          </span>
          <button
            className="button-primary"
            disabled={
              !title.trim() || Number(amount.replace(",", ".")) <= 0 || !account
            }
          >
            Registrar lançamento <ArrowRight size={15} />
          </button>
        </footer>
      </form>
    </ModalFrame>
  );
}
