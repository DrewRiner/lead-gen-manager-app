"use client";

import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Trash2,
} from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { GuideBlockView } from "@/components/guides/guide-block-view";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createGuide, saveGuide } from "@/lib/actions/guides";
import { uploadGuideMedia } from "@/lib/actions/guide-media";
import {
  BLOCK_TYPE_LABELS,
  emptyBlockContent,
  type GuideBlockContent,
  type GuideBlockType,
} from "@/lib/guides/types";

interface EditorBlock {
  key: string;
  type: GuideBlockType;
  content: GuideBlockContent;
}

interface EditorGuide {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  status: "draft" | "published";
  blocks: { type: GuideBlockType; content: GuideBlockContent }[];
}

const BLOCK_ORDER: GuideBlockType[] = ["heading", "text", "image", "video", "embed"];

export function GuideEditor({
  mode,
  guide,
}: {
  mode: "create" | "edit";
  guide?: EditorGuide;
}) {
  const router = useRouter();
  const keyRef = useRef(0);
  const nextKey = () => `b${keyRef.current++}`;

  const [title, setTitle] = useState(guide?.title ?? "");
  const [category, setCategory] = useState(guide?.category ?? "");
  const [summary, setSummary] = useState(guide?.summary ?? "");
  const [blocks, setBlocks] = useState<EditorBlock[]>(
    (guide?.blocks ?? []).map((b) => ({ key: nextKey(), type: b.type, content: b.content })),
  );
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function addBlock(type: GuideBlockType) {
    setBlocks((bs) => [...bs, { key: nextKey(), type, content: emptyBlockContent(type) }]);
  }
  function updateContent(key: string, patch: Partial<GuideBlockContent>) {
    setBlocks((bs) =>
      bs.map((b) => (b.key === key ? { ...b, content: { ...b.content, ...patch } } : b)),
    );
  }
  function removeBlock(key: string) {
    setBlocks((bs) => bs.filter((b) => b.key !== key));
  }
  function move(key: string, dir: -1 | 1) {
    setBlocks((bs) => {
      const i = bs.findIndex((b) => b.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= bs.length) return bs;
      const copy = [...bs];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function onUpload(key: string, file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading((u) => ({ ...u, [key]: true }));
    const fd = new FormData();
    fd.set("file", file);
    const res = await uploadGuideMedia(fd);
    setUploading((u) => ({ ...u, [key]: false }));
    if (!res.ok) {
      setError(res.error);
      return;
    }
    updateContent(key, { url: res.url });
  }

  function save(status: "draft" | "published") {
    setError(null);
    setMessage(null);
    if (!title.trim()) {
      setError("A title is required.");
      return;
    }
    const payload = {
      title: title.trim(),
      category: category.trim() || null,
      summary: summary.trim() || null,
      status,
      blocks: blocks.map((b) => ({
        type: b.type,
        content: b.content as unknown as Record<string, unknown>,
      })),
    };
    startTransition(async () => {
      const res =
        mode === "create" || !guide
          ? await createGuide(payload)
          : await saveGuide(guide.id, payload);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (mode === "create" && res.slug) {
        router.push(`/guides/${res.slug}/edit`);
      } else {
        setMessage(res.message ?? "Saved.");
        router.refresh();
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Meta */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="g-title">Title</Label>
          <Input
            id="g-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How to create a contact form"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="g-cat">Category</Label>
            <Input
              id="g-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Forms, Automations…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="g-sum">Summary</Label>
            <Input
              id="g-sum"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="One line describing the guide"
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-y py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPreview((p) => !p)}
          type="button"
        >
          {preview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {preview ? "Back to editing" : "Preview"}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => save("draft")}
            type="button"
          >
            Save draft
          </Button>
          <Button size="sm" disabled={pending} onClick={() => save("published")} type="button">
            {pending ? "Saving…" : "Publish"}
          </Button>
        </div>
      </div>

      {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-emerald-600">{message}</p> : null}

      {/* Body */}
      {preview ? (
        <article className="space-y-4">
          {blocks.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
          ) : (
            blocks.map((b) => (
              <GuideBlockView key={b.key} type={b.type} content={b.content} />
            ))
          )}
        </article>
      ) : (
        <div className="space-y-3">
          {blocks.map((b, i) => (
            <div key={b.key} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {BLOCK_TYPE_LABELS[b.type]}
                </span>
                <div className="flex items-center gap-1">
                  <IconBtn
                    label="Move up"
                    disabled={i === 0}
                    onClick={() => move(b.key, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn
                    label="Move down"
                    disabled={i === blocks.length - 1}
                    onClick={() => move(b.key, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </IconBtn>
                  <IconBtn label="Delete block" onClick={() => removeBlock(b.key)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </IconBtn>
                </div>
              </div>
              <BlockFields
                block={b}
                uploading={!!uploading[b.key]}
                onChange={(patch) => updateContent(b.key, patch)}
                onUpload={(file) => onUpload(b.key, file)}
              />
            </div>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" type="button" className="w-full">
                <Plus className="mr-2 h-4 w-4" /> Add block
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {BLOCK_ORDER.map((t) => (
                <DropdownMenuItem key={t} onClick={() => addBlock(t)}>
                  {BLOCK_TYPE_LABELS[t]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
    >
      {children}
    </button>
  );
}

// --- Per-type block field editors -----------------------------------------

function BlockFields({
  block,
  uploading,
  onChange,
  onUpload,
}: {
  block: EditorBlock;
  uploading: boolean;
  onChange: (patch: Partial<GuideBlockContent>) => void;
  onUpload: (file: File | undefined) => void;
}) {
  const c = block.content as unknown as Record<string, unknown>;

  switch (block.type) {
    case "heading":
      return (
        <div className="space-y-2">
          <Input
            value={(c.text as string) ?? ""}
            onChange={(e) => onChange({ text: e.target.value } as Partial<GuideBlockContent>)}
            placeholder="Section heading"
          />
          <div className="flex items-center gap-1">
            {[2, 3].map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => onChange({ level: lvl } as Partial<GuideBlockContent>)}
                className={
                  "rounded border px-2 py-0.5 text-xs " +
                  ((c.level ?? 2) === lvl
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground")
                }
              >
                H{lvl}
              </button>
            ))}
          </div>
        </div>
      );

    case "text":
      return (
        <div className="space-y-1">
          <Textarea
            value={(c.markdown as string) ?? ""}
            onChange={(e) => onChange({ markdown: e.target.value } as Partial<GuideBlockContent>)}
            rows={5}
            placeholder="Write the step here…"
          />
          <p className="text-xs text-muted-foreground">
            Supports <code>**bold**</code>, <code>[links](https://…)</code>, and{" "}
            <code>-</code> or <code>1.</code> lists.
          </p>
        </div>
      );

    case "image":
      return (
        <MediaFields
          accept="image/*"
          url={(c.url as string) ?? ""}
          caption={(c.caption as string) ?? ""}
          uploading={uploading}
          onUpload={onUpload}
          onCaption={(v) => onChange({ caption: v } as Partial<GuideBlockContent>)}
          preview={
            (c.url as string) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.url as string}
                alt=""
                className="max-h-52 w-auto rounded border"
              />
            ) : null
          }
          extra={
            <Input
              value={(c.alt as string) ?? ""}
              onChange={(e) => onChange({ alt: e.target.value } as Partial<GuideBlockContent>)}
              placeholder="Alt text (accessibility)"
            />
          }
        />
      );

    case "video":
      return (
        <MediaFields
          accept="video/*"
          url={(c.url as string) ?? ""}
          caption={(c.caption as string) ?? ""}
          uploading={uploading}
          onUpload={onUpload}
          onCaption={(v) => onChange({ caption: v } as Partial<GuideBlockContent>)}
          preview={
            (c.url as string) ? (
              <video src={c.url as string} controls className="max-h-52 rounded border" />
            ) : null
          }
          hint="Videos up to 100 MB. Larger? Use an Embed block (YouTube/Loom)."
        />
      );

    case "embed":
      return (
        <div className="space-y-2">
          <Input
            value={(c.url as string) ?? ""}
            onChange={(e) => onChange({ url: e.target.value } as Partial<GuideBlockContent>)}
            placeholder="YouTube or Loom URL"
          />
          <Input
            value={(c.caption as string) ?? ""}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<GuideBlockContent>)}
            placeholder="Caption (optional)"
          />
        </div>
      );

    default:
      return null;
  }
}

function MediaFields({
  accept,
  url,
  caption,
  uploading,
  onUpload,
  onCaption,
  preview,
  extra,
  hint,
}: {
  accept: string;
  url: string;
  caption: string;
  uploading: boolean;
  onUpload: (file: File | undefined) => void;
  onCaption: (v: string) => void;
  preview: React.ReactNode;
  extra?: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="space-y-2">
      {preview}
      <div className="flex items-center gap-2">
        <input
          type="file"
          accept={accept}
          disabled={uploading}
          onChange={(e) => onUpload(e.target.files?.[0])}
          className="text-sm"
        />
        {uploading ? (
          <span className="text-xs text-muted-foreground">Uploading…</span>
        ) : url ? (
          <span className="text-xs text-emerald-600">Uploaded</span>
        ) : null}
      </div>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {extra}
      <Input
        value={caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="Caption (optional)"
      />
    </div>
  );
}
