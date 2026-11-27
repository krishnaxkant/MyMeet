import { Router } from 'express';
import {
  analyzeScreenFrameHandler,
  generateAiSummaryHandler,
  generateMeetingMcqsHandler,
  recordTranscriptHandler,
  transcribeAudioChunkHandler,
  upgradeProNotesHandler,
} from '../controllers/aiAgentController.js';
import { listMessagesHandler, sendMessageHandler } from '../controllers/chatController.js';
import {
  createInvitationHandler,
  listMeetingInvitationsHandler,
} from '../controllers/invitationController.js';
import {
  admitAllParticipantsHandler,
  admitParticipantHandler,
  createMeetingHandler,
  endMeetingHandler,
  getMeetingHandler,
  issueMeetingTokenHandler,
  joinMeetingHandler,
  leaveMeetingHandler,
  listMeetingsHandler,
  muteParticipantHandler,
  removeParticipantHandler,
  updateMeetingSettingsHandler,
  updateParticipantRoleHandler,
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

// Waiting room & participant management
router.post('/:code/participants/admit-all', admitAllParticipantsHandler);
router.post('/:code/participants/:userId/admit', admitParticipantHandler);
router.post('/:code/participants/:userId/remove', removeParticipantHandler);
router.post('/:code/participants/:userId/mute', muteParticipantHandler);
router.patch('/:code/participants/:userId/role', updateParticipantRoleHandler);

// In-meeting chat
router.get('/:code/messages', listMessagesHandler);
router.post('/:code/messages', sendMessageHandler);

// Meeting invitations (host/co-host)
router.get('/:code/invitations', listMeetingInvitationsHandler);
router.post('/:code/invitations', createInvitationHandler);

// Internal AI Meeting Agent (voice transcript, Gemini audio chunks, shared screen visual notes, AI summary)
router.post('/:code/ai/transcript', recordTranscriptHandler);
router.post('/:code/ai/audio-chunk', transcribeAudioChunkHandler);
router.post('/:code/ai/screen-frame', analyzeScreenFrameHandler);
router.post('/:code/ai/summary', generateAiSummaryHandler);
router.post('/:code/ai/pro-notes', upgradeProNotesHandler);
router.post('/:code/ai/mcqs', generateMeetingMcqsHandler);

router.post('/:code/end', endMeetingHandler);

export default router;
