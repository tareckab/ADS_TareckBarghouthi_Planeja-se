import type { NextFunction, Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { hashToken, verifyToken, type TokenClaims } from '../auth/token.js';

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    response.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }

  let claims: TokenClaims;
  try {
    claims = verifyToken(token);
  } catch {
    response.status(401).json({ error: 'Sessão inválida ou expirada.' });
    return;
  }

  try {
    // O JWT só vale enquanto a sessão existir no banco (revogada no logout).
    const result = await pool.query(
      `SELECT id FROM sessions
       WHERE id = $1 AND user_id = $2 AND token_hash = $3 AND expires_at > now()`,
      [claims.sid, claims.sub, hashToken(token)],
    );
    if (!result.rowCount) {
      response.status(401).json({ error: 'Sessão inválida ou expirada.' });
      return;
    }
    request.userId = claims.sub;
    request.sessionId = claims.sid;
    next();
  } catch (error) {
    next(error);
  }
}
