import { Router } from 'express';
import {
  listMyInvitationsHandler,
  respondToInvitationHandler,
} from '../controllers/invitationController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', listMyInvitationsHandler);
router.post('/:id/respond', respondToInvitationHandler);

export default router;
