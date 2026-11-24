import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Category, Kind } from '../finance/model';
import { toTitleCase } from '../finance/model';
import { ModalFrame } from '../../components/finance';

/** Cadastro e gerenciamento de categorias de entrada e saída (RF04). */
export function CategoriesModal({
  categories,
  onClose,
  onCreate,
  onDelete,
}: {
  categories: Category[];
  onClose: () => void;
  onCreate: (category: { name: string; kind: Kind }) => Promise<boolean>;
  onDelete: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>("expense");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const list = categories.filter((c) => c.kind === kind);
  return (
    <ModalFrame
      title="Categorias"
      description="Organize entradas e saídas do seu jeito. Categorias com lançamentos não podem ser removidas."
      onClose={onClose}
    >
      <div className="form-body">
        <div className="segmented type-switch" role="group" aria-label="Tipo de categoria">
          {(["expense", "income"] as const).map((item) => (
            <button
              type="button"
              key={item}
              className={kind === item ? "selected" : ""}
              aria-pressed={kind === item}
              onClick={() => setKind(item)}
            >
              {item === "expense" ? "Saídas" : "Entradas"}
            </button>
          ))}
        </div>
        <form
          className="inline-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            const ok = await onCreate({ name: toTitleCase(name), kind });
            setSaving(false);
            if (ok) setName("");
          }}
        >
          <label className="form-label">
            Nova categoria de {kind === "expense" ? "saída" : "entrada"}
            <input
              placeholder={kind === "expense" ? "Ex.: Pet, Academia" : "Ex.: Aluguel recebido"}
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <button className="button-primary" disabled={!name.trim() || saving}>
            <Plus size={16} /> Adicionar
          </button>
        </form>
        <ul className="category-list">
          {list.map((c) => (
            <li key={c.id}>
              <span>
                <b>{c.name}</b>
                <small>{c.usage ? `${c.usage} ${c.usage === 1 ? "lançamento" : "lançamentos"}` : "Sem lançamentos"}</small>
              </span>
              <button
                type="button"
                className="icon-btn"
                disabled={c.usage > 0}
                title={c.usage > 0 ? "Em uso: não pode ser removida" : `Remover ${c.name}`}
                aria-label={`Remover ${c.name}`}
                onClick={() => onDelete(c.id)}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </ModalFrame>
  );
}
