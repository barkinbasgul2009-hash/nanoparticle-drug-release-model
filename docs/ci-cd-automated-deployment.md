# Automated verified merge and website deployment

How a finished task gets from a commit to the live site without anyone repeating the GitHub process
by hand — and, more importantly, what stops a task that is not finished from getting there.

## The hosting provider

**GitHub Pages.** This is read off the repository, not assumed:

| evidence | where |
|---|---|
| `actions/deploy-pages@v4`, `actions/upload-pages-artifact@v3`, `actions/configure-pages@v5` | `.github/workflows/pages.yml` |
| `environment: github-pages` | `.github/workflows/pages.yml` |
| `has_pages: true` on the repository | GitHub API |
| the published root is the `web/` directory | `upload-pages-artifact` `path: ./web` |

There is exactly **one** Pages site for this repository. `pages.yml` publishes the main web tool to
it; `deploy-teacher-demo.yml` is a manual workflow that temporarily replaces it with the Phase-7C
teacher demo. No other hosting provider appears anywhere in the repository, and this task did not
migrate, add or replace one.

`pages.yml` is **not modified** by any of this. Everything below either runs before it or observes it
from the outside.

## The pipeline

```
  push to a feature branch
        |
        v
  simulator gates ............ simulator suite · TypeScript contract · generated-asset and
        |                      manifest gates · deployable site artifact · VISUAL ACCEPTANCE
        |                      (plus the existing `tests` workflow: R suite, production JS
        |                       model tests, hidden-character scan)
        |
        |  all green?  and the PR carries `auto-merge: verified`?
        v
  auto-merge when verified ... re-reads the visual acceptance gate at the merge commit, requires
        |                      every other check on that commit to be green, then asks GitHub to
        |                      enable NATIVE auto-merge. It never merges anything itself.
        v
  GitHub merges .............. only once ITS rules are satisfied (required checks, required
        |                      reviews, rulesets). A required human review still blocks here.
        v
  Deploy web tool to GitHub Pages ....... the existing, unmodified pages.yml
        |
        v
  verify production deployment ......... fetches the real URL and compares the live bytes with
                                         web/index.html at the deployed commit
```

Two side workflows exist because the happy path is not the only path:

* **`reconcile production with main`** — scheduled, four times a day. Deploys main if the live site is
  behind it and it is safe to do so. See *The GITHUB_TOKEN gap* below.
* **`rollback production deployment`** — manual. Puts a known-good commit back on the live site.

## What gates a deployment

### Technical gates (`simulator gates`)

Every one runs the repository's real command, the same one a developer runs locally.

| job | command |
|---|---|
| simulator suite | `node simulator/tests/run.mjs` (6195 assertions: master-timeline determinism, procedural fallback, skeleton, renderer, scientific runtimes) |
| TypeScript contract | `npx -p typescript@5.6.3 tsc --noEmit -p simulator/tsconfig.json` |
| generated-asset and manifest gates | `node simulator/tools/verify-human-asset.mjs …/human.glb` and `node simulator/tools/verify-baked-asset.mjs` — the baked GLB is read from its own JSON chunk and compared bone-for-bone against the original and field-for-field against the manifest |
| deployable site artifact | rehearses the artifact `pages.yml` uploads, then `node tests/js/model.test.mjs` against the model core inline in `web/index.html` |
| all gates | one summary check that fails if any of the above failed — the check to make required, if branch protection is configured |

The pre-existing `tests` workflow (R suite, regression baseline, worked example, production JS model
tests, hidden-character scan) is untouched and runs alongside. It was not folded in or duplicated.

### The visual gate (`simulator/tools/check-acceptance.mjs`)

Test counts cannot express "the hands look wrong". Each animation lock ends with a single declared
decision line, written after looking at the actual videos, and that line is the only thing that can
authorise deploying an animation.

| lock | report | authorising phrase |
|---|---|---|
| contact and collision | `simulator/artifacts/phase2b/collision-report.md` | `CONTACT AND COLLISION LOCK PASSED` |
| arm and wrist motion | `simulator/artifacts/phase2b/motion-report.md` | `ARM AND WRIST MOTION LOCK PASSED` |
| Phase 2B completion | `simulator/artifacts/phase2b/report.md` | `PHASE 2B COMPLETION PASSED` |

A report that declares `… REMAINS BLOCKED`, or that is missing, unreadable, or contains no
recognisable decision, counts as **blocked**. A gate that opens when it cannot find its input is not
a gate. The check runs twice — once in `simulator gates`, and again in `auto-merge when verified` at
the exact commit being merged — so the opt-in label is a second condition and never a substitute.

Add a row to `LOCKS` when a new animation lock is introduced.

**As of this writing all three locks declare `REMAINS BLOCKED`**, so this branch cannot merge or
deploy. That is the machinery working, not a fault in it.

## Enabling auto-merge on a PR

1. The task's own report declares its visual gate passed.
2. Every check on the head commit is green.
3. Add the label `auto-merge: verified` to the PR.

`auto-merge when verified` then calls `gh pr merge --auto --squash`, which sets GitHub's native
auto-merge flag. GitHub performs the merge itself, and only when every required check and every
required review is satisfied. Remove the label, or cancel auto-merge from the PR page, to stop it.

Nothing in this pipeline weakens, bypasses or disables branch protection, a ruleset, a required
status check, a required reviewer or a deployment protection rule. Nothing in it uses an
administrative override merge. If GitHub refuses to enable auto-merge, the job prints GitHub's own
reason verbatim in its summary and stops — it does not route around the rule, and it does not report
the site as deployed.

**A review by an automated agent is not an independent human approval.** If the repository requires
a review, the PR waits for a person.

## The GITHUB_TOKEN gap

A push made with `GITHUB_TOKEN` does not start new workflow runs. GitHub does this on purpose, to
stop workflows triggering themselves forever. It has a consequence here: when auto-merge was enabled
using `GITHUB_TOKEN` and GitHub later performs the merge, the resulting push to `main` may not start
`pages.yml`, so main moves while the live site silently stays where it was.

`reconcile production with main` exists for exactly that. Four times a day it compares main against
the last Pages run and, if main is ahead, dispatches `pages.yml` — `workflow_dispatch` being one of
the two events `GITHUB_TOKEN` *is* allowed to raise. It refuses to dispatch when:

* main's `all gates` check is not green — this path must not become a way to ship an ungated commit;
* a Pages run for that commit already exists — no duplicate deployments;
* the last deployment of that same commit **failed** — it reports the failure and stops. Redeploying
  an unchanged commit that has already failed cannot succeed, and a scheduler that keeps trying turns
  one bad deploy into an outage nobody can interrupt.

A merge performed by a person is unaffected: it pushes normally and `pages.yml` fires immediately.

## Verifying that the site is actually live

A green deploy job means the artifact was accepted. It does not mean the page loads, and a successful
`git push` means nothing at all. `verify production deployment` runs after every Pages deployment and:

1. fails immediately, and loudly, if the deployment itself did not succeed;
2. reads the site URL from the Pages API rather than guessing it;
3. fetches the live page (retrying, because the CDN takes a moment) and compares its **sha256**
   against `web/index.html` at the deployed commit;
4. smoke-checks that the response is a real document — `<title>`, a `canvas`, plausible size — and
   that `.nojekyll` is reachable;
5. writes `deployment-record.json` as an artifact and a table to the job summary.

### Traceability of the deployed SHA

The byte-for-byte hash comparison *is* the traceability: if the live page hashes to
`sha256(web/index.html @ <sha>)`, the site is serving that commit and no other. No build stamp is
injected into the page, because application source is not this pipeline's to edit.

`deployment-record.json` records `deployed_sha`, `site_url`, `expected_sha256`, `live_sha256`,
`verified`, the deploy run URL, the verify run URL, and `rollback_target_sha`.

## Rollback

GitHub Pages keeps no previous version to click back to — the site is whatever the last successful
deployment uploaded. Recovery means redeploying an earlier commit's `web/` directory.

1. Find the target SHA: `rollback_target_sha` in the last `deployment-record.json`, or the summary
   table of any `verify production deployment` run.
2. Actions → **rollback production deployment** → Run workflow.
3. `sha` = the full commit SHA, `confirm` = `ROLLBACK`.

It refuses anything that is not an ancestor of `main`, and anything without a deployable `web/`.
`verify production deployment` then runs against the rollback and confirms — or contradicts — it.

Rollback is manual on purpose. Automatic rollback would fight with whatever caused the bad
deployment.

## Concurrency

| workflow | group | cancels in progress |
|---|---|---|
| `pages.yml`, `deploy-teacher-demo.yml`, `rollback-pages.yml` | `pages` | no — a half-applied deployment is worse than a queued one |
| `simulator-gates.yml` | `simulator-gates-<ref>` | yes, except on `main` |
| `deploy-verify.yml` | `deploy-verify` | yes — verifying a superseded deployment reports a confusing mismatch |
| `auto-merge.yml` | `auto-merge-<sha>` | no |
| `deploy-reconcile.yml` | `deploy-reconcile` | no |

All three deployment entry points share the single `pages` group, so deployments to the one Pages
site are serialised in the order they were requested.

## Permissions

Least privilege, per workflow. No workflow requests administrative scope.

| workflow | permissions | why |
|---|---|---|
| `simulator-gates.yml` | `contents: read` | runs tests; changes nothing |
| `auto-merge.yml` | `contents: read`, `pull-requests: write`, `checks: read`, `actions: read` | sets the auto-merge flag on a PR. Deliberately **no** `contents: write` — it cannot push or merge directly |
| `deploy-verify.yml` | `contents: read`, `actions: read`, `pages: read` | reads the deployment and fetches a public URL |
| `deploy-reconcile.yml` | `contents: read`, `actions: write` | dispatches the existing Pages workflow |
| `rollback-pages.yml` | `contents: read`, `pages: write`, `id-token: write` | the same scopes `pages.yml` already needs to deploy |

No workflow adds a secret, reads one, or echoes one. The only credential in use is the automatic
per-run `GITHUB_TOKEN`, which is never printed — `gh` receives it through the `GH_TOKEN` environment
variable and no step echoes that variable. `gh pr merge` failures are captured to a file and printed
as GitHub's own error text, which does not contain the token.

## Recommended repository settings

These are **not** applied by this pipeline. Changing repository security settings is the owner's
call, and this task was explicitly not to touch protection rules.

* Settings → General → Pull Requests → **Allow auto-merge**. Without it, `gh pr merge --auto` is
  refused and the job reports that refusal rather than merging some other way.
* Settings → Branches / Rulesets → protect `main` with required status checks:
  **`all gates`**, `r-tests`, `js-tests`, `hidden-char-check`. Today `main` has no protection, so the
  gates are advisory in the strict GitHub sense — the pipeline enforces them, a ruleset would make
  them unbypassable.
* Settings → Environments → `github-pages` — add a required reviewer if a person should approve every
  production deployment. The pipeline handles that correctly: the deployment waits, and nothing
  claims the site was updated.
