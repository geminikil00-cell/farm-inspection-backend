import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { getAssignments, createAssignments, startAssignment, deleteAssignment } from '../controllers/assignmentController.js';

const router = Router();
router.use(authenticate);
router.get('/', getAssignments);
router.post('/', createAssignments);
router.put('/:id/start', startAssignment);
router.delete('/:id', deleteAssignment);
export default router;
