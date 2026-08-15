# System Design for Data Engineering

A beginner's course in how data moves from where it is produced to where it is
useful — reliably, correctly and affordably. Twelve lessons, a reference page,
eighteen diagrams and 26 practice questions, built as static HTML with no
framework and no build dependencies.

## Build

```bash
node build.js          # writes docs/
open docs/index.html   # or: python3 -m http.server -d docs 8000
```

Node 18+. Nothing to install.

## Layout

```
build.js                 the entire toolchain, zero dependencies
scripts/diagram.js       SVG diagram generator
src/layout.html          page shell with {{PLACEHOLDER}} slots
src/data/site.json       page order, section labels, site metadata
src/data/questions.js    quiz question bank
src/pages/*.html         lesson content, one file per page
src/diagrams/*.svg       diagrams, inlined into pages at build time
src/assets/              styles.css, app.js, quiz.js
docs/                    build output — committed, served by GitHub Pages
```

## The course structure

Pages are ordered by **dependency, not importance** — later lessons assume
earlier ones. `foundations` is the load-bearing page; almost every other lesson
refers back to it explicitly.

| Section | Pages |
|---|---|
| Start here | `index`, `foundations` |
| The building blocks | `storage`, `ingestion`, `processing`, `orchestration` |
| The hard parts | `reliability`, `quality`, `modeling`, `cost` |
| Designing a system | `framework`, `examples` |
| Keep going | `path`, `reference` |
| Practice | `quiz` |

## Adding a page

1. Create `src/pages/my-page.html` starting with a `<!--meta {...} -->` block.
2. Add `"my-page"` to a section in `src/data/site.json`.
3. `node build.js`.

Every `<h2>` becomes a trackable topic and a table-of-contents entry. Use
`data-no-progress` to skip the checkbox, `data-no-toc` to skip the contents.

Close each substantial lesson with a **checklist of capabilities** phrased as
actions ("explain why X causes Y"), not topics. That is what lets a reader test
themselves; a summary does not.

## Adding a diagram

Write a spec, generate the SVG, then reference it by filename:

```bash
node scripts/diagram.js /tmp/spec.json -o src/diagrams/my-diagram.svg
```

```html
<figure class="diagram" data-diagram="my-diagram">
  <figcaption>What the diagram shows, in one sentence.</figcaption>
</figure>
```

Five spec types cover most needs: `stack`, `flow`, `split`, `tree`, `timeline`.
`split` is the highest-value one for teaching, because most confusion is between
a pair of similar things.

Two rules:

- **The build inlines the SVG — never use `<img>`.** An `<img>` renders in its
  own document, cannot see the page's CSS custom properties, and will sit there
  in light-mode colours on a dark page.
- **Hand-written SVGs must use only the `dg-*` classes** (`dg-box`,
  `dg-box-accent`, `dg-box-muted`, `dg-label`, `dg-sub`, `dg-arrow`,
  `dg-arrowhead`, `dg-line`, `dg-dot`) for colour. A hard-coded `fill` or
  `stroke` will be wrong in one of the two themes. `src/diagrams/star-schema.svg`
  is the one hand-written diagram here and follows this convention.

## Adding quiz questions

Edit `src/data/questions.js`, never the engine in `src/assets/quiz.js`. A
question whose `a` is an array renders as multi-select automatically.

Write the `e` explanation so it teaches even when the learner got the question
right: say why the correct answer is correct **and** why the most tempting wrong
answer is wrong. The second half is where the learning is, and it is the part
that gets skipped when writing questions quickly.

## Verifying before you publish

```bash
node build.js
node - <<'EOF'
const fs=require('fs'),path=require('path');let bad=0;
for(const f of fs.readdirSync('docs').filter(x=>x.endsWith('.html')))
  for(const m of fs.readFileSync(path.join('docs',f),'utf8').matchAll(/href="([^"#:]+\.html)/g))
    if(!fs.existsSync(path.join('docs',m[1]))){console.log('BROKEN',f,'->',m[1]);bad++}
console.log(bad+' broken links');
EOF
```

Then open it in a browser at desktop and phone width, in light and dark mode,
click through the quiz including a multi-select question, and check the diagrams
re-colour when you toggle the theme. If one stays light, it was referenced with
`<img>` or its SVG hard-codes colours.

## Deploying

Deployment is handled by GitHub Actions: `.github/workflows/deploy-pages.yml`
runs `node build.js` on every push to `main`, then publishes the `docs/` folder
to GitHub Pages. The `configure-pages` step uses `enablement: true`, so the
first successful run **turns Pages on for the repository automatically** — no
manual **Settings → Pages** step is needed.

The workflow deliberately does **not** use Jekyll. The site is plain generated
HTML and `build.js` writes a `docs/.nojekyll` marker; running Jekyll against the
repo root would promote `README.md` to `index.html` and serve the wrong content.

One-time prerequisite: under **Settings → Actions → General → Workflow
permissions**, ensure workflows are allowed to run (default for most repos). If
your org restricts Actions from enabling Pages, set **Settings → Pages → Source:
GitHub Actions** once by hand; the workflow then owns every subsequent deploy.

## A note on the content

Tool names (Snowflake, Kafka, Airflow, dbt, Spark) appear throughout to make the
ideas recognisable in job descriptions and conversations, but the course teaches
concepts rather than products. Figures such as file-size targets and storage
costs are order-of-magnitude rules of thumb, current as of the date in
`src/data/site.json`; check `reference.html` and update that date when you
revise them.
