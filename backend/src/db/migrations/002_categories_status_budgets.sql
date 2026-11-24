-- Alinha o banco ao DVP: categorias, status/prioridade de transações,
-- metas mensais de gasto/faturamento (orçamentos) e log com autor e entidade.

-- Categorias por workspace ------------------------------------------------
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('income', 'expense')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, kind, name),
  UNIQUE (id, workspace_id)
);

-- Categorias padrão criadas para todo workspace novo (chamada também no cadastro).
CREATE OR REPLACE FUNCTION seed_default_categories(target_workspace UUID)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO categories (workspace_id, kind, name)
  SELECT target_workspace, defaults.kind, defaults.name
  FROM (VALUES
    ('expense', 'Alimentação'), ('expense', 'Moradia'), ('expense', 'Transporte'),
    ('expense', 'Saúde'), ('expense', 'Lazer'), ('expense', 'Educação'),
    ('expense', 'Serviços'), ('expense', 'Operação'), ('expense', 'Impostos'),
    ('expense', 'Transferência'), ('expense', 'Outros'),
    ('income', 'Renda'), ('income', 'Renda extra'), ('income', 'Serviços'),
    ('income', 'Vendas'), ('income', 'Investimentos'), ('income', 'Transferência'),
    ('income', 'Outros')
  ) AS defaults(kind, name)
  ON CONFLICT (workspace_id, kind, name) DO NOTHING;
$$;

SELECT seed_default_categories(id) FROM workspaces;

-- Categorias já usadas em lançamentos existentes também viram registros.
INSERT INTO categories (workspace_id, kind, name)
SELECT DISTINCT workspace_id, kind, category FROM movements
ON CONFLICT (workspace_id, kind, name) DO NOTHING;

-- Transações: categoria (FK), status, prioridade, autor e data de alteração ---
ALTER TABLE movements
  ADD COLUMN category_id UUID,
  ADD COLUMN status VARCHAR(10) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  ADD COLUMN priority VARCHAR(10) NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('urgent', 'normal', 'low')),
  ADD COLUMN created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE movements m
SET category_id = c.id,
    created_by = w.owner_id
FROM categories c, workspaces w
WHERE c.workspace_id = m.workspace_id AND c.kind = m.kind AND c.name = m.category
  AND w.id = m.workspace_id;

ALTER TABLE movements
  ALTER COLUMN category_id SET NOT NULL,
  ADD CONSTRAINT movements_category_fk FOREIGN KEY (category_id, workspace_id)
    REFERENCES categories(id, workspace_id) ON DELETE RESTRICT,
  DROP COLUMN category;

CREATE INDEX movements_category_idx ON movements (category_id);
CREATE INDEX movements_account_date_idx ON movements (account_id, movement_date DESC);

-- Metas mensais de gasto (expense) ou faturamento (income) -------------------
-- category_id nulo = meta do workspace inteiro. O percentual atingido não é
-- armazenado: é calculado na consulta a partir das transações do período.
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category_id UUID,
  kind VARCHAR(10) NOT NULL CHECK (kind IN ('income', 'expense')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  month DATE NOT NULL CHECK (EXTRACT(DAY FROM month) = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT budgets_period_key UNIQUE NULLS NOT DISTINCT (workspace_id, category_id, kind, month),
  FOREIGN KEY (category_id, workspace_id)
    REFERENCES categories(id, workspace_id) ON DELETE CASCADE
);

CREATE INDEX budgets_workspace_month_idx ON budgets (workspace_id, month);

-- Log de alterações: quem fez e em qual registro ----------------------------
ALTER TABLE activity
  ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN entity VARCHAR(20) CHECK (entity IN ('movement', 'account', 'goal', 'budget', 'category')),
  ADD COLUMN entity_id UUID;
