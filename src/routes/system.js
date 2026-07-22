import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getUnits, getUnit, createUnit, updateUnit, deleteUnit,
  getUnitUsers, createUnitUser, updateUnitUser, deleteUnitUser,
  getUnitsAudits, getUnitAuditsList,
} from '../controllers/adminUnitsController.js';

const router = Router();
router.use(authenticate);

router.get('/units', getUnits);
router.get('/units/audits', getUnitsAudits);
router.get('/units/:id', getUnit);
router.post('/units', createUnit);
router.put('/units/:id', updateUnit);
router.delete('/units/:id', deleteUnit);

router.get('/units/:id/users', getUnitUsers);
router.post('/units/:id/users', createUnitUser);
router.put('/units/:id/users/:userId', updateUnitUser);
router.delete('/units/:id/users/:userId', deleteUnitUser);

router.get('/units/:id/audits', getUnitAuditsList);

export default router;
