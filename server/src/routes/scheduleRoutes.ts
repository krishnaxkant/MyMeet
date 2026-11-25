import { Router } from 'express';
import {
  createScheduleHandler,
  deleteScheduleHandler,
  listSchedulesHandler,
  startScheduleHandler,
} from '../controllers/scheduleController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', listSchedulesHandler);
router.post('/', createScheduleHandler);
router.post('/:id/start', startScheduleHandler);
router.delete('/:id', deleteScheduleHandler);

export default router;
