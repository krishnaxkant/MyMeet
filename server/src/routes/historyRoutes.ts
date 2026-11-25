import { Router } from 'express';
import { getHistoryDetailHandler, listHistoryHandler } from '../controllers/historyController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', listHistoryHandler);
router.get('/:code', getHistoryDetailHandler);

export default router;
