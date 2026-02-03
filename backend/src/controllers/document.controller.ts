import { Response } from 'express';
import mongoose from 'mongoose';
import DocumentModel, { ICollaborator } from '../models/document.model';
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
        _id: document._id,
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
    })
      .select('title ownerId collaborators createdAt updatedAt')
      .populate('collaborators.userId', 'email');

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or access denied',
      });
    }

    const collaborators = document.collaborators.map((c: any) => ({
      userId: c.userId?._id?.toString?.() ?? c.userId?.toString?.() ?? c.userId,
      role: c.role,
      email: c.userId?.email,
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        _id: document._id,
        title: document.title,
        ownerId: document.ownerId,
        collaborators,
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

export const getAllDocuments = async (
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

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    const documents = await DocumentModel.find({
      $or: [
        { ownerId: userObjectId },
        { 'collaborators.userId': userObjectId },
      ],
    })
      .select('title ownerId collaborators createdAt updatedAt')
      .populate('collaborators.userId', 'email')
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      status: 'success',
      data: documents.map((doc) => ({
        _id: doc._id,
        title: doc.title,
        ownerId: doc.ownerId,
        collaborators: doc.collaborators.map((c: any) => ({
          userId:
            c.userId?._id?.toString?.() ?? c.userId?.toString?.() ?? c.userId,
          role: c.role,
          email: c.userId?.email,
        })),
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      })),
    });
  } catch (error) {
    console.error('Get all documents error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to fetch documents',
    });
  }
};

export const addCollaborator = async (
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
    const { email, role } = req.body as {
      email: string;
      role: 'editor' | 'viewer';
    };

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document id',
      });
    }

    if (!email || !role) {
      return res.status(400).json({
        status: 'error',
        message: 'Email and role are required',
      });
    }

    if (role !== 'editor' && role !== 'viewer') {
      return res.status(400).json({
        status: 'error',
        message: 'Role must be either editor or viewer',
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    // Find the document and check if user is owner
    const document = await DocumentModel.findOne({
      _id: id,
      ownerId: userObjectId,
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or you are not the owner',
      });
    }

    // Find the user to add as collaborator
    const UserModel = (await import('../models/user.model')).default;
    const collaboratorUser = await UserModel.findOne({ email });

    if (!collaboratorUser) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found with this email',
      });
    }

    const collaboratorId = collaboratorUser._id as mongoose.Types.ObjectId;

    // Check if user is already a collaborator
    const existingCollaborator = document.collaborators.find(
      (c: ICollaborator) => c.userId.toString() === collaboratorId.toString()
    );

    if (existingCollaborator) {
      return res.status(400).json({
        status: 'error',
        message: 'User is already a collaborator',
      });
    }

    // Add collaborator
    document.collaborators.push({
      userId: collaboratorId,
      role,
    });

    await document.save();

    return res.status(200).json({
      status: 'success',
      data: {
        _id: document._id,
        collaborators: document.collaborators,
      },
    });
  } catch (error) {
    console.error('Add collaborator error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to add collaborator',
    });
  }
};

export const removeCollaborator = async (
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

    const { id, collaboratorId } = req.params;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(collaboratorId)
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document or collaborator id',
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    // Find the document and check if user is owner
    const document = await DocumentModel.findOne({
      _id: id,
      ownerId: userObjectId,
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or you are not the owner',
      });
    }

    // Remove collaborator
    document.collaborators = document.collaborators.filter(
      (c: ICollaborator) => c.userId.toString() !== collaboratorId
    );

    await document.save();

    return res.status(200).json({
      status: 'success',
      data: {
        _id: document._id,
        collaborators: document.collaborators,
      },
    });
  } catch (error) {
    console.error('Remove collaborator error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to remove collaborator',
    });
  }
};

export const updateCollaboratorRole = async (
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

    const { id, collaboratorId } = req.params;
    const { role } = req.body as { role: 'editor' | 'viewer' };

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(collaboratorId)
    ) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid document or collaborator id',
      });
    }

    if (role !== 'editor' && role !== 'viewer') {
      return res.status(400).json({
        status: 'error',
        message: 'Role must be either editor or viewer',
      });
    }

    const userObjectId = new mongoose.Types.ObjectId(user.id);

    // Find the document and check if user is owner
    const document = await DocumentModel.findOne({
      _id: id,
      ownerId: userObjectId,
    });

    if (!document) {
      return res.status(404).json({
        status: 'error',
        message: 'Document not found or you are not the owner',
      });
    }

    // Update collaborator role
    const collaborator = document.collaborators.find(
      (c: ICollaborator) => c.userId.toString() === collaboratorId
    );

    if (!collaborator) {
      return res.status(404).json({
        status: 'error',
        message: 'Collaborator not found',
      });
    }

    collaborator.role = role;
    await document.save();

    return res.status(200).json({
      status: 'success',
      data: {
        _id: document._id,
        collaborators: document.collaborators,
      },
    });
  } catch (error) {
    console.error('Update collaborator role error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to update collaborator role',
    });
  }
};
