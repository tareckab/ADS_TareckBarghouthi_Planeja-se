import type { NextFunction, Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { pool } from '../db/pool.js';

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const sessionKey = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!sessionKey) {
    response.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }

  try {
    const tokenHash = createHash('sha256').update(sessionKey).digest('hex');
    const result = await pool.query(
      'SELECT id, user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()',
      [tokenHash],
    );
    const session = result.rows[0] as { id: string; user_id: string } | undefined;
    if (!session) {
      response.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }
    request.userId = session.user_id;
    request.sessionId = session.id;
    next();
  } catch (error) {
    next(error);
  }
}
