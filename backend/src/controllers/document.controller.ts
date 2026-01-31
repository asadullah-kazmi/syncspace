import { Response } from 'express';
import mongoose from 'mongoose';
import DocumentModel from '../models/document.model';
import { AuthRequest } from '../middleware/auth.middleware';

export const createDocument = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized. Please login.',
      });
    }

    const { title, yjsSnapshot } = req.body as {
      title?: string;
      yjsSnapshot?: string | Buffer;
    };

    if (!title || title.trim().length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'Title is required',
      });
    }

    let snapshotBuffer: Buffer = Buffer.alloc(0);
    if (typeof yjsSnapshot === 'string') {
      snapshotBuffer = Buffer.from(yjsSnapshot, 'base64');
    } else if (Buffer.isBuffer(yjsSnapshot)) {
      snapshotBuffer = yjsSnapshot;
    }

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    const document = await DocumentModel.create({
      title: title.trim(),
      ownerId: userObjectId,
      collaborators: [
        {
          userId: userObjectId,
          role: 'owner',
        },
      ],
      yjsSnapshot: snapshotBuffer,
    });

    return res.status(201).json({
      status: 'success',
      data: {
        id: document._id,
        title: document.title,
        ownerId: document.ownerId,
        collaborators: document.collaborators,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    });
  } catch (error) {
    console.error('Create document error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create document',
    });
  }
};

export const getDocumentMetadata = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized. Please login.',
      });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document id',
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    const document = await DocumentModel.findOne({
      _id: id,
      $or: [
        { ownerId: userObjectId },
        { 'collaborators.userId': userObjectId },
      ],
    }).select('title ownerId collaborators createdAt updatedAt');

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or access denied',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        id: document._id,
        title: document.title,
        ownerId: document.ownerId,
        collaborators: document.collaborators,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get document metadata error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch document metadata',
    });
  }
};
