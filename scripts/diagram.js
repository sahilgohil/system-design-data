#!/usr/bin/env node
/**
 * diagram.js — generates themed, self-contained SVG diagrams for lesson pages.
 *
 *   node scripts/diagram.js spec.json > src/diagrams/three-layers.svg
 *   node scripts/diagram.js spec.json -o src/diagrams/three-layers.svg
 *   echo '{"type":"flow",...}' | node scripts/diagram.js -
 *
 * Why a generator rather than hand-written SVG: hand-authoring means recomputing
 * x/y for every box each time a label changes, and it is very easy to produce a
 * diagram that looks right in light mode and illegible in dark mode. This emits
 * geometry from a compact spec and colours everything through CSS custom
 * properties, so diagrams inherit the site's theme automatically.
 *
 * Output has no width/height attributes — only a viewBox — so the surrounding
 * .diagram wrapper controls size and the diagram scales cleanly on mobile.
 *
 * Five types, chosen because they cover most explanatory needs:
 *   stack     layers sitting on top of each other      (architecture)
 *   flow      ordered steps with arrows                (pipelines, processes)
 *   split     2–3 options compared side by side        (this vs that)
 *   tree      containment / hierarchy                  (object models)
 *   timeline  phases along an axis                     (lifecycles, retention)
 *
 * Anything that does not fit these is a signal to hand-write the SVG using the
 * same class names — see references/diagrams.md.
 */

'use strict';

const fs = require('fs');

/* ---------- layout constants ---------- */

const W = 760;                 // viewBox width; height is computed
const PAD = 16;                // outer padding
const FONT = 15;               // body label size
const SUB = 12.5;              // sub-label size
const HEAD = 16;               // column/section heading size
const LINE = 1.45;             // line-height multiplier
const R = 10;                  // corner radius

/* ---------- helpers ---------- */

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Approximate text width. Roboto/Arial average out near 0.52em for mixed-case
 * text; we use a slightly generous factor so wrapping errs toward too-early
 * rather than overflowing the box, which is the more visible failure.
 */
const textWidth = (s, size) => s.length * size * 0.545;

function wrap(text, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? line + ' ' + word : word;
    if (textWidth(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Emit a <text> block, wrapped, returning {svg, height}. */
function textBlock(x, y, content, opts = {}) {
  const size = opts.size || FONT;
  const cls = opts.cls || 'dg-label';
  const anchor = opts.anchor || 'start';
  const maxWidth = opts.maxWidth || W - PAD * 2;
  const weight = opts.weight ? ` font-weight="${opts.weight}"` : '';
  const lines = wrap(content, size, maxWidth);
  const lh = size * LINE;
  const svg = lines
    .map(
      (ln, i) =>
        `<text class="${cls}" x="${x}" y="${(y + size * 0.82 + i * lh).toFixed(1)}" ` +
        `font-size="${size}" text-anchor="${anchor}"${weight}>${esc(ln)}</text>`
    )
    .join('\n  ');
  return { svg, height: lines.length * lh };
}

function box(x, y, w, h, variant) {
  const cls = variant === 'accent' ? 'dg-box dg-box-accent' : variant === 'muted' ? 'dg-box dg-box-muted' : 'dg-box';
  return `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${R}" ry="${R}"/>`;
}

const arrowRight = (x1, y, x2) =>
  `<line class="dg-arrow" x1="${x1}" y1="${y}" x2="${x2 - 7}" y2="${y}" marker-end="url(#dg-a)"/>`;

const arrowDown = (x, y1, y2) =>
  `<line class="dg-arrow" x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 7}" marker-end="url(#dg-a)"/>`;

/* ---------- renderers ---------- */

/** Layers stacked vertically. Optional `note` prints to the right of each layer. */
function renderStack(spec) {
  const items = spec.items || [];
  const gap = 12;
  const noteW = items.some((i) => i.note) ? 210 : 0;
  const boxW = W - PAD * 2 - noteW - (noteW ? 16 : 0);
  const parts = [];
  let y = PAD;

  for (const item of items) {
    const label = textBlock(PAD + 18, 0, item.label, { size: FONT, weight: 500, maxWidth: boxW - 36 });
    const sub = item.sub ? textBlock(PAD + 18, 0, item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 36 }) : null;
    const inner = label.height + (sub ? sub.height + 2 : 0);
    const h = Math.max(56, inner + 26);

    parts.push(box(PAD, y, boxW, h, item.accent ? 'accent' : null));
    const ty = y + (h - inner) / 2;
    parts.push(textBlock(PAD + 18, ty, item.label, { size: FONT, weight: 500, maxWidth: boxW - 36 }).svg);
    if (sub) parts.push(textBlock(PAD + 18, ty + label.height + 2, item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 36 }).svg);

    if (item.note) {
      const nx = PAD + boxW + 16;
      const nb = textBlock(nx, 0, item.note, { size: SUB, cls: 'dg-sub', maxWidth: noteW });
      parts.push(textBlock(nx, y + (h - nb.height) / 2, item.note, { size: SUB, cls: 'dg-sub', maxWidth: noteW }).svg);
    }
    y += h + gap;
  }
  return { body: parts.join('\n  '), height: y - gap + PAD };
}

/** Ordered steps. Horizontal while they fit, vertical once there are many. */
function renderFlow(spec) {
  const items = spec.items || [];
  const vertical = spec.direction === 'vertical' || items.length > 4;
  const parts = [];

  if (!vertical) {
    const gap = 34;
    const boxW = (W - PAD * 2 - gap * (items.length - 1)) / items.length;
    let maxH = 0;
    const blocks = items.map((item) => {
      const l = textBlock(0, 0, item.label, { size: FONT, weight: 500, maxWidth: boxW - 24, anchor: 'middle' });
      const s = item.sub ? textBlock(0, 0, item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 24, anchor: 'middle' }) : null;
      const h = Math.max(70, l.height + (s ? s.height + 2 : 0) + 28);
      maxH = Math.max(maxH, h);
      return { item, l, s, h };
    });

    blocks.forEach((b, i) => {
      const x = PAD + i * (boxW + gap);
      const cx = x + boxW / 2;
      const inner = b.l.height + (b.s ? b.s.height + 2 : 0);
      const ty = PAD + (maxH - inner) / 2;
      parts.push(box(x, PAD, boxW, maxH, b.item.accent ? 'accent' : null));
      parts.push(textBlock(cx, ty, b.item.label, { size: FONT, weight: 500, maxWidth: boxW - 24, anchor: 'middle' }).svg);
      if (b.s) parts.push(textBlock(cx, ty + b.l.height + 2, b.item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 24, anchor: 'middle' }).svg);
      if (i < blocks.length - 1) parts.push(arrowRight(x + boxW + 8, PAD + maxH / 2, x + boxW + gap));
    });
    return { body: parts.join('\n  '), height: maxH + PAD * 2 };
  }

  const gap = 30;
  const boxW = W - PAD * 2;
  let y = PAD;
  items.forEach((item, i) => {
    const l = textBlock(PAD + 18, 0, item.label, { size: FONT, weight: 500, maxWidth: boxW - 36 });
    const s = item.sub ? textBlock(PAD + 18, 0, item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 36 }) : null;
    const inner = l.height + (s ? s.height + 2 : 0);
    const h = Math.max(52, inner + 24);
    parts.push(box(PAD, y, boxW, h, item.accent ? 'accent' : null));
    const ty = y + (h - inner) / 2;
    parts.push(textBlock(PAD + 18, ty, item.label, { size: FONT, weight: 500, maxWidth: boxW - 36 }).svg);
    if (s) parts.push(textBlock(PAD + 18, ty + l.height + 2, item.sub, { size: SUB, cls: 'dg-sub', maxWidth: boxW - 36 }).svg);
    if (i < items.length - 1) parts.push(arrowDown(W / 2, y + h + 6, y + h + gap));
    y += h + gap;
  });
  return { body: parts.join('\n  '), height: y - gap + PAD };
}

/** Two or three options side by side, each a heading plus bullet points. */
function renderSplit(spec) {
  const cols = spec.columns || [];
  const gap = 20;
  const colW = (W - PAD * 2 - gap * (cols.length - 1)) / cols.length;
  const parts = [];
  const rendered = [];
  let maxH = 0;

  for (const col of cols) {
    const chunks = [];
    let h = 20;
    const head = textBlock(0, 0, col.heading, { size: HEAD, weight: 500, maxWidth: colW - 32, anchor: 'middle' });
    chunks.push({ y: h, kind: 'head', text: col.heading, height: head.height });
    h += head.height + 12;
    for (const point of col.points || []) {
      const p = textBlock(0, 0, point, { size: SUB, cls: 'dg-sub', maxWidth: colW - 46 });
      chunks.push({ y: h, kind: 'point', text: point, height: p.height });
      h += p.height + 9;
    }
    h += 12;
    maxH = Math.max(maxH, h);
    rendered.push({ col, chunks, h });
  }

  rendered.forEach((r, i) => {
    const x = PAD + i * (colW + gap);
    parts.push(box(x, PAD, colW, maxH, r.col.accent ? 'accent' : 'muted'));
    for (const c of r.chunks) {
      if (c.kind === 'head') {
        parts.push(textBlock(x + colW / 2, PAD + c.y, c.text, { size: HEAD, weight: 500, maxWidth: colW - 32, anchor: 'middle' }).svg);
      } else {
        parts.push(`<circle class="dg-dot" cx="${x + 20}" cy="${(PAD + c.y + SUB * 0.6).toFixed(1)}" r="2.5"/>`);
        parts.push(textBlock(x + 32, PAD + c.y, c.text, { size: SUB, cls: 'dg-sub', maxWidth: colW - 46 }).svg);
      }
    }
  });
  return { body: parts.join('\n  '), height: maxH + PAD * 2 };
}

/** Containment hierarchy drawn with elbow connectors. */
function renderTree(spec) {
  const parts = [];
  const rowH = 40;
  const indent = 30;
  let y = PAD;
  const rows = [];

  (function walk(nodes, depth) {
    for (const node of nodes) {
      rows.push({ node, depth, y });
      y += rowH;
      if (node.children) walk(node.children, depth + 1);
    }
  })(spec.nodes || [], 0);

  // Connectors: one continuous spine per parent, dropping from the parent box to
  // its last child, with a short stub into each child. Drawing it per-parent
  // rather than per-child avoids the hairline gaps you get from stitching
  // together separate segments.
  rows.forEach((parent, pi) => {
    const kids = [];
    for (let j = pi + 1; j < rows.length; j++) {
      if (rows[j].depth <= parent.depth) break;
      if (rows[j].depth === parent.depth + 1) kids.push(rows[j]);
    }
    if (!kids.length) return;

    const spineX = PAD + parent.depth * indent + (parent.depth ? 16 : 0) + 14;
    const top = parent.y + 32;
    const last = kids[kids.length - 1];
    parts.push(`<path class="dg-line" d="M ${spineX} ${top} V ${last.y + 16}"/>`);
    for (const kid of kids) {
      const kidX = PAD + kid.depth * indent + 16;
      parts.push(`<path class="dg-line" d="M ${spineX} ${kid.y + 16} H ${kidX}"/>`);
    }
  });

  rows.forEach((row) => {
    const x = PAD + row.depth * indent + (row.depth ? 16 : 0);
    const label = row.node.label;
    const w = Math.min(W - PAD - x, textWidth(label, FONT) + 28);
    parts.push(box(x, row.y, w, 32, row.node.accent ? 'accent' : null));
    parts.push(textBlock(x + 14, row.y + 6, label, { size: FONT, maxWidth: w - 28 }).svg);
    if (row.node.note) {
      parts.push(textBlock(x + w + 12, row.y + 8, row.node.note, { size: SUB, cls: 'dg-sub', maxWidth: W - PAD - (x + w + 12) }).svg);
    }
  });

  return { body: parts.join('\n  '), height: y + PAD };
}

/** Phases along a horizontal axis, sized by relative weight. */
function renderTimeline(spec) {
  const phases = spec.phases || [];
  const total = phases.reduce((n, p) => n + (p.weight || 1), 0);
  const barY = PAD + 30;
  const barH = 44;
  const usable = W - PAD * 2;
  const parts = [];
  let x = PAD;
  let below = 0;

  phases.forEach((p, i) => {
    const w = (usable * (p.weight || 1)) / total;
    parts.push(box(x, barY, w - (i < phases.length - 1 ? 4 : 0), barH, p.accent ? 'accent' : p.muted ? 'muted' : null));
    const cx = x + (w - 4) / 2;
    parts.push(textBlock(cx, barY + barH / 2 - FONT * 0.7, p.label, { size: FONT, weight: 500, maxWidth: w - 16, anchor: 'middle' }).svg);
    if (p.sub) {
      const s = textBlock(cx, barY + barH + 10, p.sub, { size: SUB, cls: 'dg-sub', maxWidth: w - 8, anchor: 'middle' });
      parts.push(s.svg);
      below = Math.max(below, s.height);
    }
    x += w;
  });

  if (spec.axisLabel) {
    parts.push(textBlock(PAD, barY - 26, spec.axisLabel, { size: SUB, cls: 'dg-sub' }).svg);
  }
  return { body: parts.join('\n  '), height: barY + barH + below + PAD + 8 };
}

/* ---------- assembly ---------- */

const RENDERERS = { stack: renderStack, flow: renderFlow, split: renderSplit, tree: renderTree, timeline: renderTimeline };

function render(spec) {
  const fn = RENDERERS[spec.type];
  if (!fn) {
    throw new Error(`Unknown diagram type "${spec.type}". Expected one of: ${Object.keys(RENDERERS).join(', ')}`);
  }

  let offset = 0;
  let titleSvg = '';
  if (spec.title) {
    const t = textBlock(PAD, PAD, spec.title, { size: HEAD, weight: 500 });
    titleSvg = t.svg;
    offset = t.height + 14;
  }

  const out = fn(spec);
  // Shift the body down if a title was drawn.
  const body = offset
    ? `<g transform="translate(0 ${offset.toFixed(1)})">\n  ${out.body}\n  </g>`
    : out.body;
  const height = out.height + offset;

  const title = spec.title ? `<title>${esc(spec.title)}</title>` : '';
  const desc = spec.alt ? `<desc>${esc(spec.alt)}</desc>` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Math.ceil(height)}" role="img" class="dg">
  ${title}${desc}
  <defs>
    <marker id="dg-a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" class="dg-arrowhead"/>
    </marker>
  </defs>
  ${titleSvg}
  ${body}
</svg>
`;
}

/* ---------- cli ---------- */

if (require.main === module) {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('-o');
  const outFile = outIdx !== -1 ? args[outIdx + 1] : null;
  const input = args.find((a, i) => a !== '-o' && (outIdx === -1 || i !== outIdx + 1));

  if (!input) {
    console.error('usage: node diagram.js <spec.json|-> [-o out.svg]');
    process.exit(1);
  }

  const raw = input === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(input, 'utf8');
  let svg;
  try {
    svg = render(JSON.parse(raw));
  } catch (err) {
    console.error('diagram.js: ' + err.message);
    process.exit(1);
  }

  if (outFile) {
    fs.writeFileSync(outFile, svg);
    console.error(`wrote ${outFile}`);
  } else {
    process.stdout.write(svg);
  }
}

module.exports = { render };
