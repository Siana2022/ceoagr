"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  GripVertical,
  Heading,
  Image as ImageIcon,
  Minus,
  Plus,
  Table2,
  Trash2,
  Type,
} from "lucide-react";
import {
  availableBlockTypes,
  BLOCK_LABELS,
  compileBlocks,
  defaultBlock,
  insertBlockAt,
  moveBlockTo,
  normalizeTableRows,
  type Align,
  type Block,
} from "@/lib/modules/documents/blocks";
import { groupsFor, type TemplateContextKind } from "@/lib/modules/documents/variables";

type Props = { bodyName: string; blocksName: string; initialBlocks: Block[]; context: TemplateContextKind };

const BLOCK_ICON: Record<Block["type"], React.ReactNode> = {
  heading: <Heading size={16} />,
  text: <Type size={16} />,
  image: <ImageIcon size={16} />,
  table: <Table2 size={16} />,
  divider: <Minus size={16} />,
  spacer: <ArrowDown size={16} className="rotate-90" />,
  quote_lines: <Table2 size={16} />,
  quote_totals: <Table2 size={16} />,
  html: <Type size={16} />,
};

const ALIGN_OPTIONS: { value: Align; label: string }[] = [
  { value: "left", label: "Izquierda" },
  { value: "center", label: "Centro" },
  { value: "right", label: "Derecha" },
];

function insertAtCursor(el: HTMLTextAreaElement | HTMLInputElement | null, current: string, token: string) {
  if (!el) return `${current}${token}`;
  const start = el.selectionStart ?? current.length;
  const end = el.selectionEnd ?? current.length;
  return current.slice(0, start) + token + current.slice(end);
}

function VariablePicker({ context, onInsert }: { context: TemplateContextKind; onInsert: (key: string) => void }) {
  return (
    <select
      aria-label="Insertar dato"
      value=""
      onChange={(e) => {
        if (e.target.value) onInsert(e.target.value);
      }}
      className="input h-8 w-auto text-xs"
    >
      <option value="">+ Insertar dato…</option>
      {groupsFor(context).map((g) => (
        <optgroup key={g.id} label={g.label}>
          {g.vars.map((v) => (
            <option key={v.key} value={`{{${v.key}}}`}>{v.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function AlignButtons({ value, onChange }: { value: Align; onChange: (a: Align) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Alineación">
      {ALIGN_OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-current={value === o.value ? "true" : undefined} onClick={() => onChange(o.value)} className="!px-2 !py-1 !text-[11px]">
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DropZone({
  index,
  active,
  onOver,
  onLeave,
  onDrop,
}: {
  index: number;
  active: boolean;
  onOver: (index: number) => void;
  onLeave: (index: number) => void;
  onDrop: (index: number) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onOver(index);
      }}
      onDragLeave={() => onLeave(index)}
      onDrop={(e) => {
        e.preventDefault();
        onDrop(index);
      }}
      className={`transition-all ${active ? "my-1 h-2 rounded-full bg-brand" : "h-2"}`}
    />
  );
}

function BlockBody({ block, context, update }: { block: Block; context: TemplateContextKind; update: (patch: Partial<Block>) => void }) {
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const headingRef = useRef<HTMLInputElement | null>(null);
  const [tableFocus, setTableFocus] = useState<{ r: number; c: number } | null>(null);
  const tableRefs = useRef<(HTMLInputElement | null)[][]>([]);

  if (block.type === "heading") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Nivel de título"
            value={block.level}
            onChange={(e) => update({ level: Number(e.target.value) as 1 | 2 | 3 })}
            className="input h-8 w-28 text-xs"
          >
            <option value={1}>Título grande</option>
            <option value={2}>Título mediano</option>
            <option value={3}>Título pequeño</option>
          </select>
          <AlignButtons value={block.align} onChange={(align) => update({ align })} />
          <VariablePicker context={context} onInsert={(tok) => update({ text: insertAtCursor(headingRef.current, block.text, tok) })} />
        </div>
        <input ref={headingRef} value={block.text} onChange={(e) => update({ text: e.target.value })} className="input" placeholder="Escribe el título…" />
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="segmented" role="group" aria-label="Formato">
            <button type="button" aria-current={block.bold ? "true" : undefined} onClick={() => update({ bold: !block.bold })} className="!px-2.5 !py-1 !text-xs font-bold">N</button>
            <button type="button" aria-current={block.italic ? "true" : undefined} onClick={() => update({ italic: !block.italic })} className="!px-2.5 !py-1 !text-xs italic">K</button>
          </div>
          <AlignButtons value={block.align} onChange={(align) => update({ align })} />
          <VariablePicker context={context} onInsert={(tok) => update({ text: insertAtCursor(textRef.current, block.text, tok) })} />
        </div>
        <textarea ref={textRef} value={block.text} onChange={(e) => update({ text: e.target.value })} rows={3} className="input" placeholder="Escribe el texto…" />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="flex flex-col gap-3">
        <div className="segmented" role="group" aria-label="Origen de la imagen">
          <button type="button" aria-current={block.source === "logo" ? "true" : undefined} onClick={() => update({ source: "logo" })}>Logotipo de la empresa</button>
          <button type="button" aria-current={block.source === "custom" ? "true" : undefined} onClick={() => update({ source: "custom" })}>Subir imagen</button>
        </div>
        {block.source === "custom" && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="btn btn-secondary cursor-pointer !py-1.5 !text-xs">
              Elegir imagen…
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => update({ data: String(reader.result ?? "") });
                  reader.readAsDataURL(file);
                }}
              />
            </label>
            {block.data && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={block.data} alt="" className="h-10 max-w-32 rounded border border-slate-200 object-contain" />
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            Ancho (px)
            <input type="number" min={20} max={500} value={block.width} onChange={(e) => update({ width: Number(e.target.value) || block.width })} className="input h-8 w-20 text-xs" />
          </label>
          <AlignButtons value={block.align} onChange={(align) => update({ align })} />
        </div>
      </div>
    );
  }

  if (block.type === "table") {
    const rows = block.rows;
    const setRows = (next: string[][]) => update({ rows: next });
    const setCell = (r: number, c: number, v: string) => {
      const next = rows.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row));
      setRows(next);
    };
    const addRow = () => setRows(normalizeTableRows([...rows, Array((rows[0] ?? [""]).length).fill("")]));
    const removeRow = (r: number) => rows.length > 1 && setRows(rows.filter((_, i) => i !== r));
    const addCol = () => setRows(rows.map((row) => [...row, ""]));
    const removeCol = () => (rows[0]?.length ?? 1) > 1 && setRows(rows.map((row) => row.slice(0, -1)));

    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={block.header} onChange={(e) => update({ header: e.target.checked })} />
            La primera fila es la cabecera
          </label>
          <button type="button" onClick={addRow} className="tb-btn !w-auto gap-1 border border-slate-200 !px-2 text-xs"><Plus size={13} /> Fila</button>
          <button type="button" onClick={addCol} className="tb-btn !w-auto gap-1 border border-slate-200 !px-2 text-xs"><Plus size={13} /> Columna</button>
          <button type="button" onClick={removeCol} disabled={(rows[0]?.length ?? 1) <= 1} className="tb-btn !w-auto gap-1 border border-slate-200 !px-2 text-xs"><Minus size={13} /> Columna</button>
          <VariablePicker
            context={context}
            onInsert={(tok) => {
              if (!tableFocus) return;
              const el = tableRefs.current[tableFocus.r]?.[tableFocus.c] ?? null;
              setCell(tableFocus.r, tableFocus.c, insertAtCursor(el, rows[tableFocus.r][tableFocus.c], tok));
            }}
          />
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <tbody>
              {rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="border border-slate-200 p-1">
                      <input
                        ref={(el) => {
                          tableRefs.current[r] ??= [];
                          tableRefs.current[r][c] = el;
                        }}
                        value={cell}
                        onFocus={() => setTableFocus({ r, c })}
                        onChange={(e) => setCell(r, c, e.target.value)}
                        className={`input h-8 min-w-24 !rounded-none !border-0 !shadow-none text-xs ${block.header && r === 0 ? "font-semibold" : ""}`}
                      />
                    </td>
                  ))}
                  {rows.length > 1 && (
                    <td className="border-0 p-1">
                      <button type="button" onClick={() => removeRow(r)} aria-label="Eliminar fila" className="tb-btn !h-8 !w-8 text-slate-400 hover:text-danger"><Trash2 size={14} /></button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (block.type === "spacer") {
    return (
      <label className="flex items-center gap-2 text-xs text-muted">
        Altura (px)
        <input type="number" min={4} max={120} value={block.height} onChange={(e) => update({ height: Number(e.target.value) || block.height })} className="input h-8 w-20 text-xs" />
      </label>
    );
  }

  if (block.type === "html") {
    return (
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted">Código HTML de una plantilla anterior. Puedes editarlo, pero es avanzado: los errores no se validan.</p>
        <textarea value={block.html} onChange={(e) => update({ html: e.target.value })} rows={6} spellCheck={false} className="input font-mono text-xs" />
      </div>
    );
  }

  return <p className="text-xs text-muted">Se rellena automáticamente al generar el documento.</p>;
}

export function BlockEditor({ bodyName, blocksName, initialBlocks, context }: Props) {
  const [blocks, setBlocks] = useState<Block[]>(initialBlocks);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragRef = useRef<{ kind: "existing"; id: string } | { kind: "new"; type: Block["type"] } | null>(null);

  const types = availableBlockTypes(context);
  const body = compileBlocks(blocks);

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)));
  }
  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }
  function duplicateBlock(id: string) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      if (i === -1) return prev;
      const copy = { ...prev[i], id: `${prev[i].id}-${Math.random().toString(36).slice(2, 7)}` } as Block;
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  }
  function moveBlock(id: string, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function insertAt(index: number) {
    const drag = dragRef.current;
    if (!drag) return;
    setDragOver(null);
    setBlocks((prev) => (drag.kind === "new" ? insertBlockAt(prev, index, defaultBlock(drag.type)) : moveBlockTo(prev, drag.id, index)));
    dragRef.current = null;
  }

  const dropZoneProps = {
    onOver: setDragOver,
    onLeave: (index: number) => setDragOver((d) => (d === index ? null : d)),
    onDrop: insertAt,
  };

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={bodyName} value={body} />
      <input type="hidden" name={blocksName} value={JSON.stringify(blocks)} />

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <span className="mr-1 text-xs font-semibold text-muted">Arrastra un bloque al documento, o pulsa para añadirlo al final:</span>
        {types.map((type) => (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={() => {
              dragRef.current = { kind: "new", type };
            }}
            onClick={() => setBlocks((prev) => [...prev, defaultBlock(type)])}
            className="btn btn-secondary btn-sm cursor-grab gap-1.5 active:cursor-grabbing"
          >
            {BLOCK_ICON[type]} {BLOCK_LABELS[type]}
          </button>
        ))}
      </div>

      <div className="card flex flex-col p-4">
        <DropZone index={0} active={dragOver === 0} {...dropZoneProps} />
        {blocks.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">Arrastra aquí tu primer bloque, o pulsa uno de los botones de arriba.</p>
        )}
        {blocks.map((block, i) => (
          <div key={block.id}>
            <div
              draggable
              onDragStart={(e) => {
                dragRef.current = { kind: "existing", id: block.id };
                e.dataTransfer.effectAllowed = "move";
              }}
              className="group flex gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
            >
              <span className="mt-1 cursor-grab text-slate-300 group-hover:text-slate-400 active:cursor-grabbing" aria-hidden="true"><GripVertical size={16} /></span>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted">{BLOCK_ICON[block.type]} {BLOCK_LABELS[block.type]}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => moveBlock(block.id, -1)} disabled={i === 0} aria-label="Subir" className="tb-btn !h-7 !w-7"><ArrowUp size={14} /></button>
                    <button type="button" onClick={() => moveBlock(block.id, 1)} disabled={i === blocks.length - 1} aria-label="Bajar" className="tb-btn !h-7 !w-7"><ArrowDown size={14} /></button>
                    <button type="button" onClick={() => duplicateBlock(block.id)} aria-label="Duplicar" className="tb-btn !h-7 !w-7"><Copy size={14} /></button>
                    <button type="button" onClick={() => removeBlock(block.id)} aria-label="Eliminar bloque" className="tb-btn !h-7 !w-7 text-slate-400 hover:text-danger"><Trash2 size={14} /></button>
                  </div>
                </div>
                <BlockBody block={block} context={context} update={(patch) => updateBlock(block.id, patch)} />
              </div>
            </div>
            <DropZone index={i + 1} active={dragOver === i + 1} {...dropZoneProps} />
          </div>
        ))}
      </div>
    </div>
  );
}
