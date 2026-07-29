import React from "react";

// Minimal, SAFE markdown for guide text blocks: bold, links, and lists only.
// It returns React nodes (never HTML strings / dangerouslySetInnerHTML), so
// user content can't inject markup. Links are restricted to http(s)/mailto.

const SAFE_URL = /^(https?:|mailto:)/i;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*)|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1]) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>);
    } else if (m[3]) {
      const url = m[5];
      if (SAFE_URL.test(url)) {
        nodes.push(
          <a
            key={`${keyPrefix}-l${i}`}
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            {m[4]}
          </a>,
        );
      } else {
        nodes.push(m[4]);
      }
    }
    last = re.lastIndex;
    i++;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function renderMarkdown(md: string): React.ReactNode {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      const k = key++;
      out.push(
        <ul key={`ul${k}`} className="list-disc space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${k}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(lines[i])) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      const k = key++;
      out.push(
        <ol key={`ol${k}`} className="list-decimal space-y-1 pl-5">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${k}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    const k = key++;
    out.push(
      <p key={`p${k}`} className="leading-relaxed">
        {renderInline(para.join(" "), `p${k}`)}
      </p>,
    );
  }
  return <div className="space-y-3">{out}</div>;
}

/** Convert a YouTube/Loom URL to an embeddable iframe src, or null. */
export function embedSrc(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtube.com" || host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return `https://www.youtube.com/embed/${v}`;
  }
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    if (id) return `https://www.youtube.com/embed/${id}`;
  }
  if (host === "loom.com" || host.endsWith(".loom.com")) {
    const m = u.pathname.match(/\/(share|embed)\/([A-Za-z0-9]+)/);
    if (m) return `https://www.loom.com/embed/${m[2]}`;
  }
  return null;
}
