'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { useYjsDocument } from '../../hooks/useYjsDocument';
import { useCollaboration } from '../../hooks/useCollaboration';
import RichTextEditor from '../../components/RichTextEditor';
import ShareModal from '../../components/ShareModal';

interface DocumentMetadata {
  _id: string;
  title: string;
  ownerId: string;
  collaborators: Array<{
    userId: string;
    role: 'owner' | 'editor' | 'viewer';
  }>;
}

export default function DocumentPage() {
  const { user, token } = useAuth();
  const router = useRouter();
  const params = useParams();
  const documentId = params?.id as string;

  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  const yjsDoc = useYjsDocument(documentId);

  // Get user's role for this document
  const userRole = metadata?.collaborators.find(
    (c) => c.userId.toString() === user?.id
  )?.role || 'viewer';

  // Initialize collaboration
  const { isConnected, userCount, color } = useCollaboration({
    documentId,
    yjsDoc,
    user: user
      ? {
          id: user.id,
          email: user.email,
        }
      : null,
    permission: userRole,
    token: token || undefined,
  });

  useEffect(() => {
    if (!user || !token) {
      router.push('/login');
      return;
    }

    fetchDocumentMetadata();
  }, [user, token, documentId, router]);

  const fetchDocumentMetadata = async () => {
    try {
      const response = await fetch(
        `http://localhost:5000/api/documents/${documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }

      const data = await response.json();
      setMetadata(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load document');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error || !metadata) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">Error</h2>
            <p className="text-red-600">{error || 'Document not found'}</p>
            <button
              onClick={() => router.push('/documents')}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
            >
              Back to Documents
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <button
              onClick={() => router.push('/documents')}
              className="text-sm text-indigo-600 hover:text-indigo-700 mb-2 flex items-center gap-1"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              Back to Documents
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{metadata.title}</h1>
            <p className="text-gray-700 mt-1">
              {userRole.charAt(0).toUpperCase() + userRole.slice(1)} •{' '}
              {user?.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
              Share
            </button>
            <div
              className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
                isConnected
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}
              />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <span className="font-medium">{userCount}</span>
              <span>{userCount === 1 ? 'user' : 'users'}</span>
            </div>
          </div>
        </div>

        {/* Editor */}
        <div className="bg-white rounded-lg shadow-sm text-black border border-gray-200 p-6">
          {userRole === 'viewer' && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <p className="text-sm text-yellow-800">
                <strong>View-only mode:</strong> You can view this document but cannot make edits.
              </p>
            </div>
          )}
          
          <RichTextEditor
            yjsDoc={yjsDoc}
            userColor={color}
            role={userRole}
          />
        </div>

        <div className="mt-4 text-sm text-gray-500 text-center">
          <p>
            Changes are automatically synced across all connected users in real-time.
          </p>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        documentId={documentId}
        documentTitle={metadata?.title || ''}
        ownerId={metadata?.ownerId || ''}
        collaborators={metadata?.collaborators || []}
        onUpdate={fetchDocumentMetadata}
      />
    </div>
  );
}
