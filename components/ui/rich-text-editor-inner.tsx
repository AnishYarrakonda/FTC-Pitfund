'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Link as TiptapLink } from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, List, ListOrdered, Link, Unlink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RichTextEditorInnerProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function RichTextEditorInner({ value, onChange, placeholder, disabled, className }: RichTextEditorInnerProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: placeholder ?? 'Start typing…' }),
    ],
    content: value,
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor }) => { onChange(editor.getHTML()) },
    editorProps: { attributes: { class: 'outline-none min-h-[80px] p-3 break-words' } },
  })

  // Sync external value resets without moving cursor on every keystroke
  const currentHTML = editor?.getHTML()
  if (editor && currentHTML !== value && !editor.isFocused) {
    editor.commands.setContent(value ?? '', { emitUpdate: false })
  }

  const setLink = () => {
    const url = window.prompt('Enter URL')
    if (url === null) return
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run(); return
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  return (
    <div className={cn('min-w-0 rounded-md border border-input bg-background focus-within:ring-1 focus-within:ring-ring', disabled && 'cursor-not-allowed opacity-50', className)}>
      {!disabled && (
        <div className="flex gap-0.5 rounded-t-md border-b border-input bg-muted/40 p-1">
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBold().run()} active={editor?.isActive('bold') ?? false} title="Bold"><Bold className="h-3.5 w-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleItalic().run()} active={editor?.isActive('italic') ?? false} title="Italic"><Italic className="h-3.5 w-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleBulletList().run()} active={editor?.isActive('bulletList') ?? false} title="Bullet list"><List className="h-3.5 w-3.5" /></ToolbarButton>
          <ToolbarButton onClick={() => editor?.chain().focus().toggleOrderedList().run()} active={editor?.isActive('orderedList') ?? false} title="Ordered list"><ListOrdered className="h-3.5 w-3.5" /></ToolbarButton>
          {editor?.isActive('link')
            ? <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} active={false} title="Remove link"><Unlink className="h-3.5 w-3.5" /></ToolbarButton>
            : <ToolbarButton onClick={setLink} active={false} title="Add link"><Link className="h-3.5 w-3.5" /></ToolbarButton>}
        </div>
      )}
      <EditorContent editor={editor} className={cn(
        '[&_.tiptap]:outline-none',
        '[&_.tiptap_ul]:list-disc [&_.tiptap_ul]:pl-5',
        '[&_.tiptap_ol]:list-decimal [&_.tiptap_ol]:pl-5',
        '[&_.tiptap_li]:my-0.5',
        '[&_.tiptap_a]:text-primary [&_.tiptap_a]:underline',
        '[&_.tiptap_strong]:font-semibold',
        '[&_.tiptap_em]:italic',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:text-muted-foreground',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
      )} />
    </div>
  )
}

function ToolbarButton({ onClick, active, title, children }: { onClick: () => void; active: boolean; title: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={title} className={cn('rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground', active && 'bg-accent text-accent-foreground')}>
      {children}
    </button>
  )
}
