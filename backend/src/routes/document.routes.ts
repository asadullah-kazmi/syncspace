import { Router } from 'express';
import {
  createDocument,
  getDocumentMetadata,
} from '../controllers/document.controller';
import { protect } from '../middleware/auth.middleware';

const router = Router();

router.post('/', protect, createDocument);
router.get('/:id/metadata', protect, getDocumentMetadata);

export default router;
