-- O valor guardado de um objetivo passa a ser derivado da soma dos aportes,
-- como saldos e percentuais (nenhum valor calculado é armazenado).

-- Se algum objetivo tiver valor guardado sem aportes correspondentes, registra a diferença como aporte.
INSERT INTO goal_deposits (goal_id, amount)
SELECT g.id, g.saved - COALESCE(SUM(d.amount), 0)
FROM goals g LEFT JOIN goal_deposits d ON d.goal_id = g.id
GROUP BY g.id
HAVING g.saved - COALESCE(SUM(d.amount), 0) > 0;

ALTER TABLE goals DROP COLUMN saved;

CREATE INDEX goal_deposits_goal_idx ON goal_deposits (goal_id);
