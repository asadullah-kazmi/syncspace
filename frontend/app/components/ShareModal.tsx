'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Collaborator {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  email?: string;
}

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentTitle: string;
  ownerId: string;
  collaborators: Collaborator[];
  onUpdate: () => void;
}

export default function ShareModal({
  isOpen,
  onClose,
  documentId,
  documentTitle,
  ownerId,
  collaborators,
  onUpdate,
}: ShareModalProps) {
  const { user, token } = useAuth();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = user?.id === ownerId;

  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setRole('editor');
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  const handleAddCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/documents/${documentId}/collaborators`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, role }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to add collaborator');
      }

      setSuccess('Collaborator added successfully!');
      setEmail('');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to add collaborator');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `http://localhost:5000/api/documents/${documentId}/collaborators/${collaboratorId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to remove collaborator');
      }

      setSuccess('Collaborator removed successfully!');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to remove collaborator');
    }
  };

  const handleUpdateRole = async (collaboratorId: string, newRole: 'editor' | 'viewer') => {
    setError('');
    setSuccess('');

    try {
      const response = await fetch(
        `http://localhost:5000/api/documents/${documentId}/collaborators/${collaboratorId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ role: newRole }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update role');
      }

      setSuccess('Role updated successfully!');
      onUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to update role');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Share "{documentTitle}"</h2>
            <p className="text-sm text-gray-600 mt-1">Manage who can access this document</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Add Collaborator Form */}
          {isOwner && (
            <form onSubmit={handleAddCollaborator} className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Add people
              </label>
              <div className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={isLoading}
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                  className="px-4 py-2 border text-black border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  disabled={isLoading}
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={isLoading || !email}
                  className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          )}

          {/* Messages */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          {/* Collaborators List */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              People with access ({collaborators.length})
            </h3>
            <div className="space-y-2">
              {collaborators.map((collaborator) => (
                <div
                  key={collaborator.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                      {collaborator.email?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {collaborator.email || 'Unknown User'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {collaborator.userId === user?.id ? '(You)' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {collaborator.role === 'owner' ? (
                      <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium">
                        Owner
                      </span>
                    ) : isOwner ? (
                      <>
                        <select
                          value={collaborator.role}
                          onChange={(e) =>
                            handleUpdateRole(
                              collaborator.userId,
                              e.target.value as 'editor' | 'viewer'
                            )
                          }
                          className="px-3 py-1 text-gray-900 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                        <button
                          onClick={() => handleRemoveCollaborator(collaborator.userId)}
                          className="p-1 text-red-600 hover:text-red-700 transition-colors"
                          title="Remove collaborator"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <span className="px-3 py-1 bg-gray-200 text-gray-700 rounded-full text-sm font-medium capitalize">
                        {collaborator.role}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
