# AI usage and prompts

The assignment explicitly allowed AI tooling and asked for the prompts used.
This file is the complete record of how I built the project with AI: my
thinking at each stage, the prompts I gave — quoted in full, not summarized —
and what each stage changed in the repository. Some of the original prompts
were written informally and partly in Turkish; they are rendered here in
English, at full length. Nothing has been added that was not asked.

## Tools

- **Primary builder:** [Claude Code](https://claude.com/claude-code) in the
  desktop app, working directly in this repository. It read and wrote files,
  ran the toolchain (Go, npm, Playwright, Docker) and drove a browser to
  check the running app.
- **Independent reviewers:** I deliberately did not trust a single model with
  the final say. The design and the finished code were cross-checked with
  other AI coding assistants — a second reviewer agent inside Claude Code
  during the build, **Cursor** for a second opinion on the architecture, and
  **[Kimi Code](https://www.kimi.com/code)** for the final pre-submission
  audit, which re-ran every check from scratch (stage 9).

Using several models against each other was a conscious strategy: each review
round found real bugs that the previous round had missed, and every finding
was reproduced before it was accepted.

## How I worked

My approach was to treat the AI as a strong but fallible engineer: I set the
bar and the constraints, forced a planning phase before any code, made the AI
attack its own design before implementing it, demanded running verification
after every step, and closed with multiple independent review rounds — first
with fresh agents, then with different models entirely.

## Stage 1 — The brief

I pasted the full assignment and set expectations. I wanted engineering
judgment, not a quick hack:

> Here is a job assessment brief: [assignment text]. Build the whole thing
> with me. Before you write a single line of code, read the brief carefully,
> check the toolchain available on this machine and the current versions of
> every tool you plan to use, and come back with a design and a plan. This is
> a job assessment — the bar is production quality: clean architecture, clean
> idiomatic code, real tests, honest documentation. Every design decision
> must have a reason I can defend in an interview. If anything in the brief
> is ambiguous, ask me before deciding. Do not start coding until I approve
> the plan.

The assistant read the brief, checked the installed Go and Node versions and
the current state of the ecosystem, drafted a design, and came back with four
questions instead of code — which was exactly what I wanted.

## Stage 2 — Planning decisions

I answered its four questions:

> 1. Repository: create a private GitHub repository and push when done.
> 2. UI: a keypad calculator, like a phone's — with keyboard and paste input
>    and a history panel — rather than a form with two number fields.
> 3. Scope beyond the brief: yes to GitHub Actions CI, Playwright end-to-end
>    tests with screenshots, and an OpenAPI 3.1 spec. Keep the Go backend on
>    the standard library only.
> 4. Prompt log: keep a record of the prompts and how the AI was used; the
>    assignment asks for it.

The keypad choice mattered: it forced a real state machine on the frontend
and a much more interesting API contract than a form would have.

## Stage 3 — Attacking the design before it existed

Before approving the plan, I made the AI review its own design with fresh
eyes. A second agent was given only the requirements and the draft design —
none of the conversation — with this prompt:

> You are reviewing a design for the system described in the attached brief.
> Your only job is to find flaws. Read the design document and check every
> claim and every tooling assumption against the current documentation of the
> tools involved. Look specifically for: numeric edge cases in float64
> rounding, race conditions and lost input in the UI state machine, HTTP
> routing conflicts, and anything in the plan that a library does not
> actually support. Report each finding with a concrete failing example.
> Do not propose a redesign; find what breaks.

This was the highest-value prompt of the whole project. Before any code
existed, it caught three real defects:

- Rounding every result to 15 digits would have corrupted large integers
  such as `2^50`.
- Keys typed while a request was in flight would have been silently dropped.
- One `ServeMux` pattern combination in the routing plan panics at startup.

All three were designed out before implementation. I approved the plan.

## Stage 4 — Implementation, verified as it went

> Approved. Implement it exactly as planned, in logical commits: domain
> package first, then the HTTP layer, then the frontend. After each step run
> its tests — nothing gets committed red. Run the full gate as you go: Go
> tests with the race detector plus fuzzing and golangci-lint; Vitest, oxlint
> in type-aware mode, TypeScript and Prettier on the frontend; Playwright
> with an axe accessibility scan once the UI exists. When the app runs, open
> it in a browser and check it yourself at desktop and phone widths, in both
> themes. Every bug a check catches gets its own fix commit.

The checks earned their keep. Four bugs were caught and fixed during
implementation, each with its own commit:

- A request object with a `then` field, which would make it a thenable if
  ever awaited (oxlint).
- 16-digit results wrapping onto two lines on a 375 px phone (browser check).
- `AC` and `xʸ` failing WCAG 2.5.3, label in name (axe, in the end-to-end
  suite).
- Keys typed in the first moments after page load being lost, because the
  keyboard listener was attached after the first paint (Playwright).

## Stage 5 — Fresh-eyes review of the finished code

Once everything was green, I did not trust "green". I had a separate agent
review the finished code with no memory of building it:

> Review this repository as if you were the hiring team seeing it for the
> first time. Read the brief, then the code, then the docs. Hunt for bugs —
> especially in the rounding rules, the state machine, and the HTTP error
> handling — and for any statement in the documentation that goes further
> than the code. Reproduce every finding with a concrete input before
> reporting it. Severity over politeness.

It found five real problems, all fixed with regression tests:

- From 10¹⁵ up, rounding to 15 digits dropped real integer digits
  (`2^50 + 0.5` came out below `2^50`), and percentages lost exactness by
  dividing first. The fixes added a fuzz property that would have caught the
  rounding bug.
- Enter was captured on every button, so keyboard users could not press a
  focused history entry.
- `{"operands":5}` was misreported as out of float64 range.
- A 413 response did not close the connection.
- A few README statements went further than the code — corrected; for
  example, the docs now say a failed calculation is retried by pressing the
  same key again.

## Stage 6 — The final comprehensive round

Before submission I asked for one last, everything-at-once pass:

> Treat this as the final round before I submit. Leave nothing unchecked:
> clone the repository fresh and run every README command exactly as written
> — `make setup`, `test`, `lint`, `coverage`, `e2e`, `run`, `dev`. Verify
> that every curl example in the README prints exactly what it shows, and
> that every error example in the OpenAPI spec is pinned by a contract test.
> Extend the end-to-end suite to WebKit, iPhone and Pixel emulation, and
> Firefox in CI. Run each fuzz property for several minutes, repeat the unit
> and end-to-end suites to rule out flaky tests, and audit the production
> build with Lighthouse. Then have a second independent agent review the code
> and the documentation as the hiring team would. Fix everything it finds,
> with tests.

That second review found three more bugs, all fixed with tests:

- A button focused earlier with Tab kept taking Enter after clicks or typing.
- Rounding at every step showed through in chained calculations
  (`1 ÷ 3 × 3` read 0.999999999999999). The display now keeps a guard digit,
  as hardware calculators do.
- The busy indicator's animation kept running while hidden.

It also listed doc statements that overstated the code, which were corrected,
and running Firefox in the CI container needed one more setting
(`HOME=/root`).

## Stage 7 — Requirement-by-requirement check

I pasted the assignment email again and asked for a formal gap analysis:

> Here is the original assignment again. Go through it requirement by
> requirement — functional, non-functional, constraints, deliverables, and
> every line of the "Make sure your README includes" list — and for each one
> show me the proof: the file, the test, the endpoint, or the command output
> that satisfies it. If anything is missing or weak, say so plainly.

Every requirement mapped to something concrete; the optional items
(exponentiation, square root, percentage, Dockerfile) were all implemented.

## Stage 8 — Cross-review with other models

I did not want the submission to reflect one model's blind spots, so I
re-reviewed the architecture myself and had other AI assistants examine it:

> Review the architecture and code of this repository independently. Ignore
> what any other AI tool has said about it. Question the design decisions in
> docs/DESIGN.md — would you defend them? Check the API contract against the
> implementation and the README against reality. Report anything you would be
> embarrassed to ship.

Cursor's pass on the architecture confirmed the layered design and the
standard-library-only choice, and its questions pushed a few clarifications
into the design notes. For the final audit I brought in Kimi Code as a fully
independent checker, with the brief and a simple instruction: verify, don't
trust.

## Stage 9 — Final pre-submission audit with Kimi Code

> Go through this project against the original assignment brief. Re-run
> everything yourself: the backend and frontend test suites, the linters and
> type checks, the production build, and the coverage reports. Boot the
> server and verify every curl example in the README byte-for-byte, including
> the error cases and their HTTP statuses. Then tell me honestly: is this
> flawless and ready to submit, or is there anything left to fix?

Kimi Code re-ran the full verification from scratch: 176 Go test cases with
the race detector, 191 frontend tests, golangci-lint and oxlint with zero
findings, the production build, and a live server check of every endpoint in
the README — success cases, division by zero, `null` operands, unknown
routes, wrong methods — all matching the documented output exactly, with the
Go binary serving the built frontend as promised. It confirmed the repository
was clean (no build output or editor files committed) and the submission
ready.

## Stage 10 — Polish

> Is the README overkill for a reviewer? Condense it to what a reviewer needs
> first and move the detailed reasoning to docs/DESIGN.md. Then rewrite this
> prompt log: keep every stage and every prompt in full — no summaries — and
> include the cross-review with the other models.

The README was condensed, the rationale moved to
[docs/DESIGN.md](docs/DESIGN.md), and this log became the file you are
reading.

## What I learned

The pattern that worked: never let the same mind — human or model — both
build and approve. Planning before code, a design review that only looks for
flaws, running verification after every step, and closing with independent
reviewers (fresh agents first, different models last) caught eleven real bugs
in a calculator — most of them in places I would never have thought to test.
