import { Router } from 'express';
import {
  admitParticipantHandler,
  createMeetingHandler,
  endMeetingHandler,
  getMeetingHandler,
  issueMeetingTokenHandler,
  joinMeetingHandler,
  leaveMeetingHandler,
  listMeetingsHandler,
  removeParticipantHandler,
  updateMeetingSettingsHandler,
} from '../controllers/meetingController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);

router.post('/', createMeetingHandler);
router.get('/', listMeetingsHandler);
router.get('/:code', getMeetingHandler);
router.post('/:code/join', joinMeetingHandler);
router.post('/:code/leave', leaveMeetingHandler);
router.post('/:code/token', issueMeetingTokenHandler);
router.patch('/:code/settings', updateMeetingSettingsHandler);
router.post('/:code/participants/:userId/admit', admitParticipantHandler);
router.post('/:code/participants/:userId/remove', removeParticipantHandler);
router.post('/:code/end', endMeetingHandler);

export default router;
