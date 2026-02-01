import { Router } from 'express';
import {
  createDocument,
  getDocumentMetadata,
  getAllDocuments,
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.get('/', protect, getAllDocuments);
router.post('/', protect, createDocument);
router.get('/:id', protect, getDocumentMetadata);

export default router;
