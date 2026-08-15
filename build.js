#!/usr/bin/env node
/**
 * Static learning-site builder.
 *
 * Zero dependencies on purpose: `node build.js` is the whole toolchain, so the
 * site can be built on any machine with Node installed and served from any
 * static host (GitHub Pages included) with no install step.
 *
 * It takes content partials from src/pages/, wraps each in src/layout.html,
 * and writes plain HTML into docs/ along with a generated search index.
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'docs');

const site = JSON.parse(fs.readFileSync(path.join(SRC, 'data', 'site.json'), 'utf8'));
const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');

/* ---------- helpers ---------- */

const slugify = (s) =>
  s.toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);

const stripTags = (html) =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- load pages ---------- */

const order = site.sections.flatMap((s) => s.pages);

const pages = order.map((slug) => {
  const file = path.join(SRC, 'pages', slug + '.html');
  if (!fs.existsSync(file)) throw new Error('Missing page partial: ' + file);
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^<!--meta([\s\S]*?)-->/);
  if (!m) throw new Error('Page is missing its <!--meta {...} --> block: ' + slug);
  const meta = JSON.parse(m[1]);
  return { slug, meta, body: raw.slice(m[0].length).trim() };
});

/* ---------- inline diagrams ---------- */

/**
 * Replace <figure class="diagram" data-diagram="slug"> with the contents of
 * src/diagrams/slug.svg.
 *
 * The SVG is inlined rather than referenced with <img> for one specific reason:
 * an <img> renders in its own document and cannot see the page's CSS custom
 * properties, so a diagram loaded that way would keep light-mode colours in
 * dark mode. Inlining lets every diagram inherit the theme for free.
 */
const DIAGRAMS = path.join(SRC, 'diagrams');

function inlineDiagrams(html, slug) {
  return html.replace(
    /<figure class="diagram" data-diagram="([^"]+)"\s*>/g,
    (full, name) => {
      const file = path.join(DIAGRAMS, name + '.svg');
      if (!fs.existsSync(file)) {
        console.warn(`  ! ${slug}: no diagram "${name}" (expected src/diagrams/${name}.svg)`);
        return '<figure class="diagram">';
      }
      return '<figure class="diagram">\n' + fs.readFileSync(file, 'utf8').trim();
    }
  );
}

for (const page of pages) {
  page.body = inlineDiagrams(page.body, page.slug);
}

/* ---------- process each page: heading ids, anchors, TOC, topic markers ---------- */

for (const page of pages) {
  const toc = [];
  const topics = [];

  // Snapshot the searchable text before anchors and checkboxes are injected,
  // so "#" and "Done" never leak into search snippets.
  page.text = stripTags(page.body.replace(/<svg[\s\S]*?<\/svg>/g, ' '));

  page.body = page.body.replace(
    /<(h2|h3)([^>]*)>([\s\S]*?)<\/\1>/g,
    (full, tag, attrs, inner) => {
      const idMatch = attrs.match(/id="([^"]+)"/);
      const id = idMatch ? idMatch[1] : slugify(inner);
      const cleanAttrs = attrs.replace(/\s*id="[^"]+"/, '');
      const text = stripTags(inner);
      // Headings inside decorative blocks (hero, cards) are opted out of the
      // table of contents so it stays a real outline of the lesson.
      if (!/data-no-toc/.test(attrs)) {
        toc.push({ level: tag === 'h2' ? 2 : 3, id, text });
      }

      let marker = '';
      if (tag === 'h2' && !/data-no-progress/.test(attrs)) {
        topics.push(id);
        marker =
          `<label class="topic-check" title="Mark this topic as done">` +
          `<input type="checkbox" data-topic="${esc(id)}"><span>Done</span></label>`;
      }

      return (
        `<${tag} id="${esc(id)}"${cleanAttrs} class="anchored">` +
        `<a class="anchor" href="#${esc(id)}" aria-label="Link to this section">#</a>` +
        `${inner}${marker}</${tag}>`
      );
    }
  );

  page.toc = toc;
  page.topics = topics;
}

/* ---------- nav ---------- */

function buildNav(currentSlug) {
  let html = '';
  for (const section of site.sections) {
    html += `<p class="nav-label">${esc(section.label)}</p><ul class="nav-list">`;
    for (const slug of section.pages) {
      const p = pages.find((x) => x.slug === slug);
      const active = slug === currentSlug ? ' class="active" aria-current="page"' : '';
      const badge = p.meta.weight ? `<span class="nav-badge">${esc(p.meta.weight)}</span>` : '';
      html += `<li><a href="${slug}.html"${active}>${esc(p.meta.navTitle || p.meta.title)}${badge}</a></li>`;
    }
    html += '</ul>';
  }
  return html;
}

function buildToc(page) {
  if (!page.toc.length) return '';
  return (
    '<ul class="toc-list">' +
    page.toc
      .map((h) => `<li class="toc-l${h.level}"><a href="#${esc(h.id)}">${esc(h.text)}</a></li>`)
      .join('') +
    '</ul>'
  );
}

function buildPrevNext(i) {
  const prev = pages[i - 1];
  const next = pages[i + 1];
  if (!prev && !next) return '';
  let html = '<nav class="prevnext" aria-label="Course navigation">';
  html += prev
    ? `<a class="pn pn-prev" href="${prev.slug}.html"><span>Previous</span><b>${esc(prev.meta.navTitle || prev.meta.title)}</b></a>`
    : '<span></span>';
  html += next
    ? `<a class="pn pn-next" href="${next.slug}.html"><span>Next</span><b>${esc(next.meta.navTitle || next.meta.title)}</b></a>`
    : '<span></span>';
  return html + '</nav>';
}

/* ---------- render ---------- */

// Clear stale output, but never let an undeletable file abort the build.
// Files can be locked by an editor on Windows, or sit on a mount that
// forbids unlink; overwriting in place is a perfectly good fallback.
try {
  fs.rmSync(OUT, { recursive: true, force: true });
} catch (err) {
  console.warn(`Could not clear ${path.relative(ROOT, OUT)} (${err.code}); overwriting in place.`);
}
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

pages.forEach((page, i) => {
  const eyebrow = page.meta.eyebrow
    ? `<p class="eyebrow">${esc(page.meta.eyebrow)}</p>`
    : '';

  const html = layout
    .replace(/\{\{SLUG\}\}/g, esc(page.slug))
    .replace(/\{\{TITLE\}\}/g, esc(page.meta.title))
    .replace(/\{\{DESCRIPTION\}\}/g, esc(page.meta.description || site.tagline))
    .replace(/\{\{LEDE\}\}/g, page.meta.lede || '')
    .replace(/\{\{EYEBROW\}\}/g, eyebrow)
    .replace(/\{\{NAV\}\}/g, buildNav(page.slug))
    .replace(/\{\{TOC\}\}/g, buildToc(page))
    .replace(/\{\{PREVNEXT\}\}/g, buildPrevNext(i))
    .replace(/\{\{SITE_TITLE\}\}/g, esc(site.title))
    .replace(/\{\{BRAND\}\}/g, site.brandHtml || esc(site.title))
    .replace(/\{\{FOOTER_NOTE\}\}/g, esc(site.footerNote || ''))
    .replace(/\{\{UPDATED\}\}/g, esc(site.updated || ''))
    .replace(/\{\{PAGE_SCRIPTS\}\}/g, (page.meta.scripts || [])
      .map((src) => `<script src="assets/${esc(src)}"></script>`).join('\n'))
    .replace(/\{\{CONTENT\}\}/g, page.body);

  fs.writeFileSync(path.join(OUT, page.slug + '.html'), html);
});

/* ---------- search index + topic registry ---------- */

const index = pages.map((p) => ({
  slug: p.slug,
  title: p.meta.navTitle || p.meta.title,
  lede: stripTags(p.meta.lede || ''),
  headings: p.toc.map((h) => ({ id: h.id, text: h.text })),
  text: p.text.slice(0, 24000)
}));

const topics = Object.fromEntries(pages.map((p) => [p.slug, p.topics]));

fs.writeFileSync(
  path.join(OUT, 'assets', 'search-index.js'),
  'window.SPC_INDEX = ' + JSON.stringify(index) + ';\n' +
    'window.SPC_TOPICS = ' + JSON.stringify(topics) + ';\n'
);

/* ---------- copy static assets ---------- */

for (const f of fs.readdirSync(path.join(SRC, 'assets'))) {
  fs.copyFileSync(path.join(SRC, 'assets', f), path.join(OUT, 'assets', f));
}
fs.copyFileSync(path.join(SRC, 'data', 'questions.js'), path.join(OUT, 'assets', 'questions.js'));
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

const diagramCount = fs.existsSync(DIAGRAMS)
  ? fs.readdirSync(DIAGRAMS).filter((f) => f.endsWith('.svg')).length
  : 0;
const totalTopics = pages.reduce((n, p) => n + p.topics.length, 0);
const words = pages.reduce((n, p) => n + p.text.split(/\s+/).length, 0);
console.log(
  `Built ${pages.length} pages · ${totalTopics} topics · ${diagramCount} diagrams · ~${words.toLocaleString()} words → docs/`
);
