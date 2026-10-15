"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, Heading1, Heading2, Heading3, Italic, List, ListOrdered,
  Minus, Redo2, Strikethrough, Table2, Underline as UnderlineIcon, Undo2,
} from "lucide-react";
import { chipifyVariables } from "@/lib/modules/documents/render";
import { groupsFor, type TemplateContextKind } from "@/lib/modules/documents/variables";

// Inline "chip" for {{variables}}; stored as <span data-var="x">{{x}}</span>.
const Variable = Node.create({
  name: "variable",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      name: {
        default: "",
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-var"),
        renderHTML: (attrs) => ({ "data-var": attrs.name }),
      },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-var]" }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { class: "var-chip" }), `{{${node.attrs.name}}}`];
  },
});

type Props = { name: string; initialHtml: string; context: TemplateContextKind };

export function TemplateEditor({ name, initialHtml, context }: Props) {
  const [html, setHtml] = useState(initialHtml);
  const [source, setSource] = useState(false);
  const groups = useMemo(() => groupsFor(context), [context]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Variable,
    ],
    content: chipifyVariables(initialHtml),
    editorProps: { attributes: { "aria-label": "Contenido de la plantilla", role: "textbox", "aria-multiline": "true" } },
    onUpdate: ({ editor }) => setHtml(editor.getHTML()),
  });

  // Keep the editor in sync when the HTML source is edited by hand.
  useEffect(() => {
    if (!editor || source) return;
    if (chipifyVariables(html) !== editor.getHTML()) editor.commands.setContent(chipifyVariables(html), { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  if (!editor) return <div className="card h-72 animate-pulse" aria-busy="true" />;

  const btn = (label: string, icon: React.ReactNode, active: boolean, run: () => void, disabled = false) => (
    <button type="button" className="tb-btn" aria-label={label} title={label} aria-pressed={active} disabled={disabled} onClick={run}>
      {icon}
    </button>
  );
  const chain = () => editor.chain().focus();
  const sep = <span className="mx-1 h-5 w-px bg-slate-200" aria-hidden="true" />;

  return (
    <div className="flex flex-col gap-3">
      <input type="hidden" name={name} value={html} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50 p-2">
          {btn("Negrita", <Bold size={16} />, editor.isActive("bold"), () => chain().toggleBold().run())}
          {btn("Cursiva", <Italic size={16} />, editor.isActive("italic"), () => chain().toggleItalic().run())}
          {btn("Subrayado", <UnderlineIcon size={16} />, editor.isActive("underline"), () => chain().toggleUnderline().run())}
          {btn("Tachado", <Strikethrough size={16} />, editor.isActive("strike"), () => chain().toggleStrike().run())}
          {sep}
          {btn("Título 1", <Heading1 size={16} />, editor.isActive("heading", { level: 1 }), () => chain().toggleHeading({ level: 1 }).run())}
          {btn("Título 2", <Heading2 size={16} />, editor.isActive("heading", { level: 2 }), () => chain().toggleHeading({ level: 2 }).run())}
          {btn("Título 3", <Heading3 size={16} />, editor.isActive("heading", { level: 3 }), () => chain().toggleHeading({ level: 3 }).run())}
          {sep}
          {btn("Lista con viñetas", <List size={16} />, editor.isActive("bulletList"), () => chain().toggleBulletList().run())}
          {btn("Lista numerada", <ListOrdered size={16} />, editor.isActive("orderedList"), () => chain().toggleOrderedList().run())}
          {sep}
          {btn("Alinear a la izquierda", <AlignLeft size={16} />, editor.isActive({ textAlign: "left" }), () => chain().setTextAlign("left").run())}
          {btn("Centrar", <AlignCenter size={16} />, editor.isActive({ textAlign: "center" }), () => chain().setTextAlign("center").run())}
          {btn("Alinear a la derecha", <AlignRight size={16} />, editor.isActive({ textAlign: "right" }), () => chain().setTextAlign("right").run())}
          {sep}
          {btn("Insertar tabla", <Table2 size={16} />, false, () => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run())}
          {btn("Línea separadora", <Minus size={16} />, false, () => chain().setHorizontalRule().run())}
          {sep}
          {btn("Deshacer", <Undo2 size={16} />, false, () => chain().undo().run(), !editor.can().undo())}
          {btn("Rehacer", <Redo2 size={16} />, false, () => chain().redo().run(), !editor.can().redo())}
          <span className="flex-1" />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
            Insertar dato
            <select
              aria-label="Insertar variable"
              className="input h-8 w-52 text-xs"
              value=""
              onChange={(e) => {
                if (e.target.value) chain().insertContent({ type: "variable", attrs: { name: e.target.value } }).insertContent(" ").run();
              }}
            >
              <option value="">Elegir…</option>
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {g.vars.map((v) => (<option key={v.key} value={v.key}>{v.label}</option>))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {editor.isActive("table") && (
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-sky-50 px-2 py-1.5 text-xs">
            <span className="mr-1 font-semibold text-slate-600">Tabla:</span>
            {[
              ["+ Fila", () => chain().addRowAfter().run()],
              ["+ Columna", () => chain().addColumnAfter().run()],
              ["− Fila", () => chain().deleteRow().run()],
              ["− Columna", () => chain().deleteColumn().run()],
              ["Fila de cabecera", () => chain().toggleHeaderRow().run()],
              ["Eliminar tabla", () => chain().deleteTable().run()],
            ].map(([label, run]) => (
              <button key={label as string} type="button" onClick={run as () => void} className="rounded-md px-2 py-1 font-medium text-slate-700 hover:bg-sky-100">
                {label as string}
              </button>
            ))}
          </div>
        )}

        {source ? (
          <textarea
            aria-label="Código HTML de la plantilla"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={18}
            spellCheck={false}
            className="block w-full border-0 p-4 font-mono text-xs outline-none"
          />
        ) : (
          <div className="editor-surface bg-white">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted">
        <p>
          Los datos entre llaves (como <span className="var-chip">{"{{contact.name}}"}</span>) se sustituyen al generar el documento.
        </p>
        <button type="button" className="link" onClick={() => setSource((s) => !s)}>
          {source ? "Volver al editor visual" : "Ver código HTML (avanzado)"}
        </button>
      </div>
    </div>
  );
}
