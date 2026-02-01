import { Router } from 'express';
import {
  createDocument,
  getDocumentMetadata,
  getAllDocuments,
  addCollaborator,
  removeCollaborator,
  updateCollaboratorRole,
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/', protect, getAllDocuments);
router.post('/', protect, createDocument);
router.get('/:id', protect, getDocumentMetadata);
router.post('/:id/collaborators', protect, addCollaborator);
router.delete(
  '/:id/collaborators/:collaboratorId',
  protect,
  removeCollaborator
);
router.patch(
  '/:id/collaborators/:collaboratorId',
  protect,
  updateCollaboratorRole
);

export default router;
