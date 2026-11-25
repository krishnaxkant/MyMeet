import { Router } from 'express';
import {
  deleteDeviceHandler,
  listDevicesHandler,
  registerDeviceHandler,
} from '../controllers/deviceController.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = Router();
router.use(requireAuth);

router.get('/', listDevicesHandler);
router.post('/', registerDeviceHandler);
router.delete('/:id', deleteDeviceHandler);

export default router;
