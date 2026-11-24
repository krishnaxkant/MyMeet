import { Router } from 'express';
import { getMe, updateMe } from '../controllers/profileController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();

router.use(requireAuth);
router.get('/', getMe);
router.patch('/', updateMe);

export default router;
