import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  publishTemplate,
  deleteTemplate,
  archiveTemplate,
} from '../controllers/templateController.js';

const router = Router();

router.use(authenticate);

router.get('/', getTemplates);
router.get('/:id', getTemplate);
router.post('/', createTemplate);
router.put('/:id', updateTemplate);
router.post('/:id/publish', publishTemplate);
router.delete('/:id', deleteTemplate);
router.post('/:id/archive', archiveTemplate);

export default router;
