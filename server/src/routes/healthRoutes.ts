import { Router } from 'express';
import { getHealth, getSupabaseHealth } from '../controllers/healthController.js';

const router = Router();

router.get('/', getHealth);
router.get('/supabase', getSupabaseHealth);

export default router;
