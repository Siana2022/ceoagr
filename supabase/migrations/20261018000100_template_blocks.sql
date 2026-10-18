-- Document templates: store the block structure used by the drag-and-drop
-- builder alongside the compiled HTML body (`body` keeps powering the PDF
-- render pipeline unchanged; `blocks` is only read back by the editor).

alter table public.document_templates
  add column blocks jsonb;
