import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateRecord } from '../middleware/validate.js';
import {
  getRecords,
  getRecord,
  createRecord,
  deleteRecord,
} from '../controllers/recordController.js';

const router = Router();

router.use(authenticate);

router.get('/', getRecords);
router.get('/:id', getRecord);
router.post('/', validateRecord, createRecord);
router.delete('/:id', deleteRecord);

export default router;
