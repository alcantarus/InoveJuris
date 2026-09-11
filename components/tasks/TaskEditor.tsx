'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { useEffect } from 'react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

interface TaskEditorProps {
  content: string;
  onChange: (content: string) => void;
}

export default function TaskEditor({ content, onChange }: TaskEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Descreva os detalhes do compromisso...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  return (
    <div className="prose prose-sm max-w-none border rounded-lg p-2 min-h-[150px]">
      <EditorContent editor={editor} />
    </div>
  );
}
