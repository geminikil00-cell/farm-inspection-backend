import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDepartments, createDepartment, deleteDepartment,
  addUserToDepartment, removeUserFromDepartment, getDepartmentUsers,
} from '../controllers/departmentController.js';

const router = Router();
router.use(authenticate);

router.get('/', getDepartments);
router.post('/', createDepartment);
router.delete('/:id', deleteDepartment);
router.get('/:id/users', getDepartmentUsers);
router.post('/:id/users/:userId', addUserToDepartment);
router.delete('/:id/users/:userId', removeUserFromDepartment);

export default router;
