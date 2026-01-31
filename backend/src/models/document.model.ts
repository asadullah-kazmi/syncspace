import mongoose, { Schema, Document as MongooseDocument } from 'mongoose';

export interface ICollaborator {
  userId: mongoose.Types.ObjectId;
  role: 'owner' | 'editor' | 'viewer';
}

export interface IDocument extends MongooseDocument {
  title: string;
  ownerId: mongoose.Types.ObjectId;
  collaborators: ICollaborator[];
  yjsSnapshot: Buffer;
  createdAt: Date;
  updatedAt: Date;
}

const CollaboratorSchema = new Schema<ICollaborator>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      enum: ['owner', 'editor', 'viewer'],
      default: 'viewer',
      required: true,
    },
  },
  { _id: false }
);

const DocumentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 255,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    collaborators: {
      type: [CollaboratorSchema],
      default: [],
    },
    yjsSnapshot: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
DocumentSchema.index({ ownerId: 1, createdAt: -1 });
DocumentSchema.index({ 'collaborators.userId': 1 });

const DocumentModel =
  mongoose.models.Document ||
  mongoose.model<IDocument>('Document', DocumentSchema);

export default DocumentModel;
