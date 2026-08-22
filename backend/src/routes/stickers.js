import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listStickerPacks } from '../data/stickers.js';

export const stickersRouter = Router();
stickersRouter.use(authMiddleware);

stickersRouter.get('/', (_req, res) => {
  res.json({ ok: true, packs: listStickerPacks() });
});
