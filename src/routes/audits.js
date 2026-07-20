import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAudits, getAudit, createAudit, updateAuditResponses, submitAudit, deleteAudit,
} from '../controllers/auditController.js';

const router = Router();
router.use(authenticate);

router.get('/', getAudits);
router.get('/:id', getAudit);
router.post('/', createAudit);
router.put('/:id/responses', updateAuditResponses);
router.post('/:id/submit', submitAudit);
router.delete('/:id', deleteAudit);

export default router;
