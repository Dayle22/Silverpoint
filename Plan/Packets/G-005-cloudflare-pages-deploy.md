# G-005 - Deploy the browser build to Cloudflare Pages

Task ID: G-005
Packet state: Ready
Packet revision: 1
Project goal link: Plan/endgoal.md
Depends on: G-002c
Related: G-003b, G-004
Prepared from: User request 2026-08-25 — "can we deploy it to cloudflare pages" and "once its on cloudflare pages, can other people start using the app".
Expanded at: 2026-08-25 09:12 Africa/Johannesburg
Expanded against: `App/public/_headers`; `App/public/_redirects`; `App/package.json` scripts and `packageManager`; `App/vite.config.ts`; `App/vite/pwa.ts`; `App/src/app/collab/room.ts`; `App/src/constants.ts`; `App/dist/` from the last local build.
Delivery: **Production build required** — see the authorisation note below. No desktop build, no version bump.
Execution size: 1 core implementation file; 0 test files; plus external Cloudflare configuration; no split required.

**Delivery-policy exception — requires explicit user authorisation in the execution session.**
`Plan/plan.md` forbids builds unless the user authorises one or the change cannot be proven otherwise.
A Pages deployment cannot be validated without a production build, so this packet requires exactly one
local `vite build`. **Do not run it without the user's go-ahead in that session.** No desktop build,
NSIS installer, or version bump is authorised.

**Outward-facing action — requires explicit user confirmation.** Step 5 creates a publicly reachable
website. Confirm with the user before executing it. Content published to the open web may be cached or
indexed even if later removed.

## Intended Outcome

The browser build of Silverpoint is live on Cloudflare Pages at a URL the user can share, built from a
branch they chose, with correct WASM headers and SPA routing.

## Request Coverage

> "can we deploy it to cloudflare pages?"
> "once its on cloudflare pages, can other people start using the app?"

Yes to both, with the scope limits recorded under Verified Starting State. This packet performs the
deployment and records what visitors actually get.

## Verified Starting State

### Cloudflare Pages config already exists — upstream ships it

```
public/_headers      /canvaskit.wasm            → Content-Type: application/wasm
                     /canvaskit-webgpu/canvaskit.wasm → Content-Type: application/wasm
public/_redirects    /*  /index.html  200       → SPA fallback
```

`_headers` and `_redirects` are Cloudflare Pages conventions. Vite copies `public/` into `dist/`, and
both files are present in the last local `dist/`. No new config is needed.

### Build facts

| Fact | Value |
| --- | --- |
| Build script | `"build": "bun run build:packages && bun run lint && vite build"` |
| `packageManager` | `bun@1.3.10` |
| `engines` field | **absent** |
| `.nvmrc` / `.bun-version` | **absent** |
| `vite.config.ts` `base` | **not set** — defaults to `/`, correct for a root-domain Pages site |
| Output directory | `dist` |
| Last local `dist/` size | 27 MB; largest file `canvaskit.wasm` at 6.8 MB |
| Required env vars | **none** — source references only `import.meta.env.BASE_URL` and `.DEV`, both built in |
| PWA | `registerType: 'autoUpdate'`, `maximumFileSizeToCacheInBytes: 12 MB` — covers `canvaskit.wasm` |

Cloudflare Pages limits are 25 MB per file and 20,000 files; this build is comfortably inside both.

**The default `build` script gates on lint.** A lint failure would fail the deploy for reasons
unrelated to the build. Fixed Decision 2 addresses this.

**Bun availability on Cloudflare's build image is unverified.** A web search during expansion returned
nothing authoritative about which Bun version the current Pages build image ships, or whether it
honours `packageManager`. Step 4 treats this as a runtime check with a named fallback rather than an
assumption.

### What visitors actually get

13 files gate behaviour on `IS_TAURI`, so the browser build is a reduced application:

| Works in the browser | Desktop only — absent from the Pages build |
| --- | --- |
| Canvas, vector, layout, components, tokens, variables | MCP server and sidecars |
| `.fig` and `.pen` import/export | Claude / Codex / Antigravity agent integration |
| SVG, PDF, PNG, JPG, WebP export; barcodes and QR | Native file dialogs, file watching, local disk save/reopen |
| Real-time collaboration | Desktop menus, tab bar, auto-update |
| AI chat with a user-supplied key | |

### Collaboration works with no backend

`src/app/collab/room.ts` uses **Trystero over MQTT** (`import { joinRoom } from 'trystero/mqtt'`),
with public STUN (`stun.l.google.com:19302`, `stun.cloudflare.com:3478`) and a public TURN fallback
(`turn:openrelay.metered.ca:443`). There is no Worker to deploy and no server to run. Collaboration
therefore works from a static Pages site as shipped.

The `packages/collab/.wrangler/` entry at `.gitignore:59` is **stale** — that package exists neither in
this tree nor in upstream `master` (verified via the GitHub contents API; upstream's `packages/` holds
`cli, core, demos, docs, dom-css, fig, harness, kiwi, mcp, pen, scene-graph, vue`). Leave the line
alone; removing it is not this packet's job.

`src/constants.ts:72` sets `TRYSTERO_APP_ID = 'openpencil'`. It is referenced exactly once, at
`room.ts:32`, and **no test asserts it**. It is the signalling namespace: while it stays `'openpencil'`,
Silverpoint users share a room namespace with OpenPencil's users and room IDs can collide across the
two applications.

**Do not confuse this with the JSX export style**, also spelled `'openpencil'`, at
`src/app/document/export/files.ts:84`, `src/app/document/export/types.ts:4`,
`src/components/CodePanel.vue:20,28,108`, `src/app/automation/bridge/export-handlers.ts:28` and
`packages/cli/src/commands/export.ts:22`. That value is public CLI API and **must not change**.

## Read First

1. `src/constants.ts` line 72 — the `TRYSTERO_APP_ID` export.
2. `App/public/_headers` and `App/public/_redirects` — confirm both are present and unchanged.

Nothing else.

## Fixed Decisions

1. **Deploy from a branch, not `master`.** G-002c deliberately left `origin/master` at upstream HEAD,
   421 commits ahead of this project's code. Pointing Pages at `master` would build **OpenPencil**, not
   Silverpoint.
2. **Set the Pages build command to `bun run build:packages && bunx vite build`.** This skips the lint
   gate in the default `build` script, so a style warning cannot fail a deployment. Lint remains a
   local gate under the ordinary packet policy.
3. **Change `TRYSTERO_APP_ID` to `'silverpoint'`.** Once the app is publicly reachable, sharing a
   signalling namespace with a different application is a correctness problem, not a preference. One
   constant, one call site, no test to update.
4. **Do not add `wrangler.toml` or any Worker.** Collaboration needs no backend; adding one would be
   scope invention.
5. **Do not set a custom domain in this packet.** The generated `*.pages.dev` URL is sufficient to
   prove the deployment. A custom domain is a separate, DNS-touching decision.

## Open Decisions

1. **Which branch Pages builds from.** Recommended default: `snapshot/divergence-2026-07-17`, the
   branch G-002c pushed. Consequence: the live site is this project's code as of the 2026-07-17
   upstream base — correct and working, but without upstream's last 421 commits. This is a
   **checkpoint deployment, not a shipping site.** Alternative: wait for G-004 porting to finish and
   deploy the ported branch. Ask the user which they want before step 5; if they are unavailable,
   take the default and label the deployment clearly in the report.

2. **Free public collaboration infrastructure.** The STUN servers and `openrelay.metered.ca` TURN
   relay are third-party and free, with rate limits and no uptime guarantee, and signalling metadata
   transits a public MQTT broker even though document data is peer-to-peer. Recommended default:
   accept for now and record the limitation. Alternative: provision a paid TURN service before
   inviting real users. Do not change any of these endpoints in this packet.

## Allowed Changes

- `src/constants.ts` — line 72 only, the `TRYSTERO_APP_ID` value.
- Cloudflare Pages project configuration, created through the user's Cloudflare account.
- This packet's `## Status record` section only.

No other file under `App/` may be created, modified or deleted. `dist/` is gitignored build output and
does not count as a change.

## Restrictions and Exclusions

Binding. An implementer who wants to cross one of these should stop and report.

- **Do not run the build without explicit user authorisation in the session.**
- **Do not create the Pages project without explicit user confirmation** — it publishes a public site.
- Do not point Pages at `master`. See Fixed Decision 1.
- Do not change the JSX export style value `'openpencil'` anywhere. See Verified Starting State.
- Do not edit `public/_headers`, `public/_redirects`, `vite.config.ts`, `vite/pwa.ts`, or
  `src/app/collab/room.ts`.
- Do not change any STUN or TURN endpoint.
- Do not add `wrangler.toml`, a Worker, or any new dependency.
- Do not remove the stale `packages/collab/.wrangler/` line from `.gitignore`.
- Do not configure a custom domain, analytics, Web Analytics, or Access.
- Do not commit or push. If step 1's edit needs committing, that is a separate authorised action —
  report it rather than doing it.
- No desktop build, NSIS install, or version bump.
- No `bun run check`, `bun run test`, `bun run test:unit`, or any umbrella suite.
- No edits to `Plan/plan.md`.

### Deferred to a later packet

- Deploying the ported branch once G-004 completes.
- A custom domain and its DNS records.
- Paid TURN provisioning, if collaboration moves beyond demo use.
- Removing the stale `packages/collab/.wrangler/` gitignore line.

## Implementation Steps

1. **Change the signalling namespace.** In `src/constants.ts` line 72, change
   `export const TRYSTERO_APP_ID = 'openpencil'` to
   `export const TRYSTERO_APP_ID = 'silverpoint'`. Change nothing else in the file, and change no other
   occurrence of `'openpencil'` anywhere in the tree.

2. **Confirm the Pages config files are intact.**

   ```
   cat public/_headers
   cat public/_redirects
   ```

   Expected: the two `application/wasm` entries, and `/*  /index.html  200`.

3. **Run one local production build — authorisation required.** Confirm the user has authorised a
   build in this session, then from `C:\Users\User\Documents\OpenPotlood\App`:

   ```
   bun run build:packages && bunx vite build
   ```

   Expected: exit 0, and `dist/` regenerated. Then verify the Pages files were copied through and the
   size is sane:

   ```
   ls dist/_headers dist/_redirects
   du -sh dist
   find dist -type f -size +25M
   ```

   Expected: both files present; roughly 27 MB total; **no file over 25 MB**. If any file exceeds
   25 MB, stop and report — it breaches a Cloudflare Pages hard limit.

4. **Confirm the deployment target with the user**, per Open Decision 1, then create the Pages project
   in the user's Cloudflare dashboard:

   | Setting | Value |
   | --- | --- |
   | Source | Connect to Git → `Dayle22/Silverpoint` |
   | Production branch | the branch chosen in Open Decision 1 — **not `master`** |
   | Framework preset | None |
   | Build command | `bun run build:packages && bunx vite build` |
   | Build output directory | `dist` |
   | Root directory | leave empty — the repository root *is* the app |
   | Environment variables | none required |

   Connecting the repository requires authorising Cloudflare's GitHub app on the user's account. **The
   user must do this themselves** — do not enter their credentials.

   **Bun version fallback.** If the build fails because Bun is missing or too old, add the Pages
   environment variable `BUN_VERSION=1.3.10` and retry. If Bun is unavailable on the build image
   entirely, stop and report — do not silently substitute npm or yarn, which would resolve a different
   dependency tree from `bun.lock`.

5. **Deploy — user confirmation required.** Trigger the first build. Expected: it completes and
   Cloudflare returns a `*.pages.dev` URL.

6. **Verify the live site.** Open the URL and confirm:

   - the editor shell loads and the canvas renders;
   - the browser console shows no error, in particular none about `canvaskit.wasm` MIME type — a
     failure here means `_headers` did not apply;
   - a deep link such as `<url>/#/` or any in-app route reloads without a 404 — this proves
     `_redirects` applied;
   - the tab title reads `Silverpoint`;
   - drawing a rectangle and undoing it works.

7. **Verify collaboration end-to-end.** Open the site in two separate browser profiles or devices,
   start a share session in one, join from the other, and confirm cursors and edits propagate. Record
   whether connection succeeded on the first attempt and how long it took. If it fails, report it as a
   finding — do not begin changing STUN/TURN endpoints.

## Acceptance Criteria

- [ ] `src/constants.ts:72` reads `TRYSTERO_APP_ID = 'silverpoint'`.
- [ ] No other occurrence of `'openpencil'` in the tree changed; the JSX export style is intact.
- [ ] The local build exited 0 and `dist/_headers` and `dist/_redirects` exist.
- [ ] No file in `dist/` exceeds 25 MB.
- [ ] A Cloudflare Pages project exists, built from the branch agreed in Open Decision 1, **not from
      `master`**.
- [ ] The build command is `bun run build:packages && bunx vite build` and the output directory is
      `dist`.
- [ ] The `*.pages.dev` URL loads the editor with no console error, and no WASM MIME error.
- [ ] A deep link reloads without a 404.
- [ ] Two-peer collaboration was attempted and its outcome recorded, pass or fail.
- [ ] No custom domain, Worker, `wrangler.toml`, or new dependency was added.
- [ ] Exactly one file under `App/` changed.

## Verification

### Development loop — repeat as needed

Not applicable. Step 1 is a one-line edit; every other step is verified by its own output.

### Final pre-completion gates — run once

From `C:\Users\User\Documents\OpenPotlood\App`:

```
grep -n "TRYSTERO_APP_ID" src/constants.ts
```

Expected: `'silverpoint'`.

```
grep -rn "'openpencil'" src packages/cli/src | grep -v node_modules
```

Expected: the six JSX-export-style occurrences only — **no collab occurrence**.

```
bunx tsgo --noEmit
```

```
bunx oxlint -c oxlint.json src/constants.ts
```

## Integration or Installed-Result Check

The live-site checks in steps 6 and 7 are this packet's integration proof. A local `bun run dev`
browser check is **not** sufficient here, because `_headers` and `_redirects` are inert on the Vite
dev server and only take effect once Cloudflare serves the site — the two things most likely to break
are exactly the two a local check cannot see.

## Stop Conditions

Stop and report rather than proceeding if:

- the user has not authorised a build, or has not confirmed creating a public site;
- any file in `dist/` exceeds 25 MB;
- `public/_headers` or `public/_redirects` is missing or altered;
- Bun is unavailable on the Cloudflare build image — do not substitute npm or yarn;
- the Pages build fails for a reason not fixed by setting `BUN_VERSION`;
- the live site reports a `canvaskit.wasm` MIME error — report rather than editing `_headers`;
- collaboration fails to connect — report rather than changing STUN/TURN endpoints;
- any change would be required outside `src/constants.ts`.

## Execution Report Contract

Report: the branch Pages was pointed at and why; the build command and output directory as configured;
whether `BUN_VERSION` was needed and its value; the local build's exit code and `dist/` size; the
`*.pages.dev` URL; the step 6 observations item by item; the step 7 collaboration outcome including
whether it connected first time; explicit confirmation that no custom domain, Worker, or dependency
was added and that the JSX export style is unchanged; any assumption used; any gap left open.

State plainly in the report whether this is a **checkpoint deployment** of pre-port code or a shipping
deployment, so nobody mistakes one for the other later.

## Status record

Expanded 2026-08-25 09:12 Africa/Johannesburg. Verified during expansion: `public/_headers` and
`public/_redirects` already carry the Cloudflare Pages WASM and SPA-fallback config; the build needs no
environment variables; `vite.config.ts` sets no `base`; the last `dist/` was 27 MB with `canvaskit.wasm`
at 6.8 MB, inside Pages limits; collaboration runs on Trystero over MQTT with public STUN/TURN and needs
no backend; `packages/collab` exists in neither this tree nor upstream `master`, making the `.gitignore`
reference stale; `TRYSTERO_APP_ID` is defined once, used once, and asserted by no test; 13 files gate on
`IS_TAURI`, so the browser build is a reduced application. Bun availability on Cloudflare's build image
could not be confirmed from documentation and is handled as a runtime check with a `BUN_VERSION`
fallback.

Execution attempted 2026-08-25 12:39 Africa/Johannesburg. The user authorised the production build
and public deployment by instructing execution of G-005. Used the recommended checkpoint branch,
`snapshot/divergence-2026-07-17`. Changed only `src/constants.ts:72`, setting `TRYSTERO_APP_ID` to
`'silverpoint'`; `bun run build:packages && bunx vite build` exited 0; `dist/` contains 510 files
totalling 26,112,319 bytes (24.90 MiB), with no file over 25 MiB; `dist/_headers` and
`dist/_redirects` are present. `bunx tsgo --noEmit` and focused Oxlint both exited 0. Deployment is
blocked before Pages project creation: `wrangler whoami` reported no authentication, and two
`wrangler login` OAuth attempts timed out without receiving the browser callback. No Cloudflare Pages
project or public URL was created, so live-site and two-peer collaboration verification remain open.
Final reconciliation also found a packet contradiction: the Git-integrated deployment must build the
remote branch, but this packet forbids committing or pushing its required namespace edit. Local `HEAD`
and `origin/snapshot/divergence-2026-07-17` both resolve to `949642233f2f214a69c087c100a00099e86e1a82`,
and the remote branch still contains `TRYSTERO_APP_ID = 'openpencil'`. Completing the specified
Git-integrated deployment therefore also requires separate authorisation to commit and push the
one-line edit, or an explicit decision to use Direct Upload instead.

Authentication retry 2026-08-25: `wrangler login` completed successfully and `wrangler whoami`
confirmed OAuth access to the Cloudflare account with Pages write permission. The authentication
blocker is cleared; the Git-integrated deployment still requires the commit/push versus Direct Upload
decision recorded above.

Execution continued 2026-08-25. The user authorised and the executor pushed commit `6995e617`, which
isolates the Trystero namespace, followed by `b68f9847`, adding `.lfsconfig` with
`lfs.fetchexclude = tests/fixtures/**`. The latter was required because GitHub's exhausted LFS budget
blocked Cloudflare while downloading test-only fixtures. Local Git LFS verification showed the
exclude was loaded and preserved the pointer without a download; Cloudflare then confirmed a clean
checkout of `b68f9847`. That deployment reached the configured build command but exposed a new runtime
fact: this Pages build did not run dependency installation. `bun run build:packages` therefore caused
`bunx` to fetch `tsdown@latest`, which failed to import optional peer `unrun`. The configured command
must be revised to `bun install --frozen-lockfile && bun run build:packages && bunx vite build` and the
deployment retried. This supersedes Fixed Decision 2's assumption that Pages installs dependencies
before the user command. Live-site and collaboration verification remain open.

Deployment completed 2026-08-25 14:30 Africa/Johannesburg. Cloudflare Pages project `silverpoint`
successfully deployed commit `b68f9847673ea2f60f6a18639931f3481da4fd30` from production branch
`snapshot/divergence-2026-07-17` as deployment `1af08acf-a535-4f12-bb56-042cce2529ab`. The stable URL
is `https://silverpoint-blt.pages.dev`; the immutable deployment URL is
`https://1af08acf.silverpoint-blt.pages.dev`. Output remains `dist`, root remains blank, and no custom
domain, Worker, analytics, Access, environment variable, or dependency was added. `BUN_VERSION` was
not needed. A second build-runtime finding supersedes the preceding provisional command: on the Linux
Pages image, package CLIs with a Node shebang ran under Node, so locked `tsdown@0.22.3` selected its
absent optional `unrun` loader. The successful command is
`bun install --frozen-lockfile && bun run --bun build:packages && bunx --bun vite build`; Bun's `--bun`
flag forces those CLIs to use the Bun runtime without changing the repository dependency tree.

Live verification passed for the editor shell, rendered design canvas, `Silverpoint` tab title, and a
rectangle draw followed by undo. The browser recorded no warning or error. Both `canvaskit.wasm` URLs
returned HTTP 200 with `Content-Type: application/wasm`. Reloading `/demo` returned HTTP 200 HTML and
loaded the editor, proving the SPA fallback. Two-peer collaboration was attempted in two live tabs at
`/share/g005test`, but neither tab rendered the name input or Join control, so a peer connection could
not be initiated. Source inspection identified the immediate product gap: `JoinRoomPrompt.vue`,
`ShareOrJoinRoom.vue`, and `ConnectedRoom.vue` exist, but `CollabPanel.vue` mounts only the avatar stack
and export popover. Per this packet's stop condition, no collaboration UI, STUN, or TURN change was
made. JSX export-style occurrences of `'openpencil'` remain intact. The App branch is clean and matches
its remote at `b68f9847`. This is a checkpoint deployment of the pre-port branch, not a shipping
deployment. The necessary, user-authorised LFS checkout repair means two App files differ from the
pre-execution base (`src/constants.ts` and `.lfsconfig`), superseding the original one-file acceptance
assumption.
