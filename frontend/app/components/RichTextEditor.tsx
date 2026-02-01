'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Collaboration from '@tiptap/extension-collaboration';
import { useEffect, useState } from 'react';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';

interface RichTextEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  yjsDoc?: Y.Doc;
  awareness?: Awareness;
  user?: {
    name: string;
    color: string;
  };
  userColor?: string;
  role?: 'owner' | 'editor' | 'viewer';
  userRole?: 'owner' | 'editor' | 'viewer';
}

const MenuBar = ({ editor, yjsDoc }: { editor: Editor | null; yjsDoc?: Y.Doc }) => {
  if (!editor) {
    return null;
  }

  return (
    <div className="border-b border-gray-300 p-2 flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('bold')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Bold
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('italic')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Italic
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleStrike().run()}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('strike')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Strike
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCode().run()}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('code')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        } disabled:opacity-50 disabled:cursor-not-allowed`}
      >
        Code
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setParagraph().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('paragraph')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        Paragraph
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('heading', { level: 1 })
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        H1
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('heading', { level: 2 })
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        H2
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('heading', { level: 3 })
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        H3
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('bulletList')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        Bullet List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('orderedList')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        Ordered List
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('codeBlock')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        Code Block
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        className={`px-3 py-1 rounded border ${
          editor.isActive('blockquote')
            ? 'bg-gray-800 text-white border-gray-800'
            : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
        }`}
      >
        Blockquote
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
      >
        Horizontal Rule
      </button>
      {!yjsDoc && (
        <>
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="px-3 py-1 rounded border bg-white text-gray-700 border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Redo
          </button>
        </>
      )}
    </div>
  );
};

export default function RichTextEditor({
  content = '',
  onChange,
  placeholder = 'Start typing...',
  editable = true,
  className = '',
  yjsDoc,
  awareness,
  user,
  role,
  userRole,
}: RichTextEditorProps) {
  // Determine if editor should be editable based on role
  // Support both 'role' and 'userRole' props for backward compatibility
  const effectiveRole = role || userRole;
  const isEditable = yjsDoc 
    ? (effectiveRole === 'owner' || effectiveRole === 'editor') && editable
    : editable;

  const [updateCounter, setUpdateCounter] = useState(0);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
      ...(yjsDoc
        ? [
            Collaboration.configure({
              document: yjsDoc,
              field: 'content',
            }),
          ]
        : []),
    ],
    content: yjsDoc ? undefined : content,
    editable: isEditable,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange?.(html);
      setUpdateCounter((prev) => prev + 1);
    },
    onSelectionUpdate: () => {
      setUpdateCounter((prev) => prev + 1);
    },
  });

  useEffect(() => {
    if (editor && !yjsDoc && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor, yjsDoc]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable);
    }
  }, [isEditable, editor]);

  // Set awareness state when user info or editor changes
  useEffect(() => {
    if (awareness && user && editor) {
      awareness.setLocalStateField('user', {
        name: user.name,
        color: user.color,
      });
    }
  }, [awareness, user, editor]);

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden bg-white ${className}`}
    >
      {isEditable && <MenuBar editor={editor} yjsDoc={yjsDoc} />}
      {!isEditable && effectiveRole === 'viewer' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-sm text-yellow-800">
          📖 You have view-only access to this document
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose prose-sm sm:prose lg:prose-lg xl:prose-xl max-w-none p-4 focus:outline-none min-h-[200px]"
      />
    </div>
  );
}
