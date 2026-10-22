import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : '';

  if (!token) {
    response.status(401).json({ error: 'Autenticação necessária.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET);
    if (typeof payload === 'string' || typeof payload.sub !== 'string') {
      response.status(401).json({ error: 'Token inválido.' });
      return;
    }
    request.userId = payload.sub;
    next();
  } catch {
    response.status(401).json({ error: 'Token inválido ou expirado.' });
  }
}
