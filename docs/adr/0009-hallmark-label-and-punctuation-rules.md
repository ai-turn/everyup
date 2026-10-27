# Hallmark label and punctuation rules replace our own exceptions

Status: accepted

Date: 2026-10-27

## Context

We installed the [Hallmark](https://github.com/Nutlope/hallmark) design skill
(`.claude/skills/hallmark`, untracked) and ran its static linter over the
frontend:

```
node .claude/skills/hallmark/scripts/sloplint.mjs web/frontend/src --scope app --genre modern-minimal
```

The first run reported 74 FAIL and 12 WARN across 139 files. Beyond real bugs
(`transition-all`, decorative `<svg>` without `aria-hidden`, fixed the same
day), several findings contradicted rules that `web/frontend/DESIGN.md`
explicitly allowed or prescribed:

| Hallmark gate | What DESIGN.md said before |
|---|---|
| 67 tracked caps | `uppercase` and `tracking-wide(r)` allowed on English labels (`API Key`, channel type); log levels rendered `ERROR`/`WARN` |
| 63 template punctuation | Meta lines joined by ` · `, sometimes three or four in a row (`역할 · 세션 JWT 7일 · 로컬 비밀번호`), and a `·` span between `DetailMeta` status items |
| 19 copy tells | `—` as the empty-value mark and as a clause joiner in UI copy; `–` in ranges |
| F2 | `...` in loading text and placeholders |
| 19 (WARN) | `All rights reserved` in the footer |
| 7b pure white | `bg-surface` and `ui-raised` are `#ffffff` in light mode |

DESIGN.md was also inconsistent with itself: §4.5 already told English table
heads to look like their Korean neighbours, while §2.2 still allowed tracked
capitals on English labels.

## Decision

We adopt Hallmark's rules for labels and punctuation in UI copy, and DESIGN.md
§2.5 now states them:

- **No tracked capitals.** Labels, captions, table heads, tags, chips and
  badges are never `uppercase` and never tracked past `tracking-normal`,
  English included. Capitals stay where the text itself is capitalised: an
  acronym (`CPU`, `HTTP`, `TCP`), an HTTP method (`GET`), initials, a brand
  name (`Telegram`, not `TELEGRAM`). Log levels and severities show the value
  as the server sends it (`error`, `warn`, `critical`).
- **At most one spaced middle dot per line.** `A · B` stays legal in a caption
  or byline. Three or more facts become columns (`flex flex-wrap gap-x-3`
  spans), a list of like items joins with `, `, and `DetailMeta` status items
  rely on the row's gap instead of a `·` span. The unspaced Korean
  enumeration mark (`오류·경고`, `CPU·메모리·디스크`) is orthography, not a
  separator, and stays.
- **No em or en dash in UI copy.** Clauses join with a colon, comma, full stop
  or parentheses; ranges use `~` (`1~20`, `13:00 ~ 13:20`). The empty-value
  mark is `-`, the Korean table convention, meaning "unknown" exactly as `—`
  did. Code comments, mock log messages and shell snippets shown as code are
  not UI copy.
- **`…` is the ellipsis character.** Never three full stops.
- **No stock footer line.** The footer says `© <year> EveryUp`.

Two findings are recorded as not applying, so later runs do not reopen them:

- **Pure white surfaces stay.** Hallmark's gate 7b lets the modern-minimal
  genre, which is ours (developer tool), use `#fff` paper; sloplint only
  reports it when run without `--genre modern-minimal`. Every contrast figure
  in DESIGN.md §1.3 is measured against `#ffffff`, so tinting it would mean
  re-measuring the table for no gain.
- **Third-party previews stay literal.** `ChannelForm` reproduces Telegram,
  Discord and Slack messages, including their brand colours, emoji and the
  Discord `APP` tag. DESIGN.md §1.7 already exempts it; Hallmark's gates 30a,
  48 and 67 fire there and are false positives. The same goes for gate 48 on
  `index.css`, where sloplint does not recognise the `.dark` token block.

`scripts/check-design-rules.mjs` (run by `pnpm lint`) now counts `uppercase`,
wide `tracking-*`, `transition-all` and `...` in strings, so these cannot come
back silently. Middle dots and dashes are judged by context and stay with
sloplint and review.

## Consequences

- Rerunning sloplint after this change gives 40 FAIL and 4 WARN, all of them
  known: 35 in the `ChannelForm` preview, 2 for the `.dark` token block and 1
  for the missing Hallmark stamp (gate 20, which only applies to pages Hallmark
  built) in `index.css`, 1 in `SidebarIcons.tsx` where `aria-hidden` comes
  from the spread `defaults()` object that a static scan cannot see, 1 for the
  `›` in `Pagination.tsx`, which is an icon button with its own `aria-label`
  rather than an arrow glued to link text, and WARN 74 for the existing
  `slate-*` debt (DESIGN.md §10.A) that we already track.
- `-` reads less precisely than `—` as a typographic mark. We accept that for
  one punctuation rule across the app instead of a per-context exception.
- Hallmark's other gates (eyebrows, decorative status dots before labels,
  hero and page-shape rules) were not part of this decision. Marketing-page
  gates do not apply to app screens; anything else surfaces in a new
  sloplint run and gets its own decision.
