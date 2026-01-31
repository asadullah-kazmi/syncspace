'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as Y from 'yjs';

/**
 * Hook to create and manage a Yjs document
 * Returns a Y.Doc instance that persists across re-renders
 */
export function useYjsDocument() {
  const yjsDocRef = useRef<Y.Doc | null>(null);

  if (!yjsDocRef.current) {
    yjsDocRef.current = new Y.Doc();
  }

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      yjsDocRef.current?.destroy();
    };
  }, []);

  return yjsDocRef.current;
}

/**
 * Hook to get the Y.Text instance from a Yjs document
 * @param yjsDoc - The Yjs document
 * @param fieldName - The field name in the shared types (default: 'content')
 */
export function useYText(yjsDoc: Y.Doc, fieldName: string = 'content') {
  return useMemo(() => {
    return yjsDoc.getText(fieldName);
  }, [yjsDoc, fieldName]);
}
