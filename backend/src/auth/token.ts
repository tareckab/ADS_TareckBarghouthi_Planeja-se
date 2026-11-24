import { createHash, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

type Queryable = { query: (text: string, values?: unknown[]) => Promise<unknown> };

export type TokenClaims = { sub: string; sid: string };

const SESSION_HOURS = 12;
const ISSUER = 'planeja-se-api';
const AUDIENCE = 'planeja-se-web';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * Emite um JWT (HS256) e registra a sessão correspondente no banco.
 * O token carrega o id do usuário (sub) e o id da sessão (sid); a linha em `sessions`
 * permite invalidar o token no logout antes de ele expirar (HU03).
 */
export async function issueToken(db: Queryable, userId: string) {
  const sessionId = randomUUID();
  const token = jwt.sign({ sid: sessionId }, config.JWT_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: `${SESSION_HOURS}h`,
  });
  await db.query('DELETE FROM sessions WHERE expires_at <= now()');
  await db.query(
    `INSERT INTO sessions (id, user_id, token_hash, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(hours => $4))`,
    [sessionId, userId, hashToken(token), SESSION_HOURS],
  );
  return token;
}

/** Valida assinatura, emissor, audiência e expiração. Lança erro se o token for inválido. */
export function verifyToken(token: string): TokenClaims {
  const payload = jwt.verify(token, config.JWT_SECRET, {
    algorithms: ['HS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
    throw new jwt.JsonWebTokenError('Formato de token inválido.');
  }
  return { sub: payload.sub, sid: payload.sid };
}
