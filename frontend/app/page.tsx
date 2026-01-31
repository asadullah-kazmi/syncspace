'use client';

import RichTextEditor from './components/RichTextEditor';
import { useYjsDocument } from './hooks/useYjsDocument';
import { useState } from 'react';

export default function Home() {
  const yjsDoc = useYjsDocument();
  const [content, setContent] = useState('');

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">SyncSpace</h1>
          <p className="text-gray-600">Collaborative Document Editor with Yjs</p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Document Editor</h2>
          <RichTextEditor
            yjsDoc={yjsDoc}
            onChange={setContent}
            placeholder="Start collaborating..."
            className="min-h-[400px]"
          />
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-semibold mb-2">HTML Output:</h3>
          <pre className="text-sm bg-white p-4 rounded border overflow-auto max-h-60">
            {content || '<empty>'}
          </pre>
        </div>
      </div>
    </div>
  );
}
