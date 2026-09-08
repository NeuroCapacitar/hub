param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$ledgerPath = Join-Path $PSScriptRoot '2026-09-06-audit-coverage.csv'
$backupRoot = 'C:/Users/Junior/.codex/instruction-remediation/2026-09-06'
$changes = [System.Collections.Generic.List[object]]::new()
function Set-FrontmatterDescription([string]$text, [string]$description) {
    $frontmatter = [regex]::Match($text, '(?ms)^---\r?\n(.*?)\r?\n---')
    if (-not $frontmatter.Success) { return $text }
    $body = $frontmatter.Groups[1].Value
    $newBody = [regex]::Replace($body, '(?ms)^description:.*?(?=\r?\n[A-Za-z][A-Za-z0-9_-]*:|\z)', ('description: ' + $description))
    if ($newBody -eq $body) { return $text }
    return $text.Substring(0, $frontmatter.Groups[1].Index) + $newBody + $text.Substring($frontmatter.Groups[1].Index + $frontmatter.Groups[1].Length)
}
$usingBody = @'
---
name: using-superpowers
description: Select relevant Superpowers workflows when the user requests that workflow or needs help choosing one.
---

# Select a workflow

Use skills whose stated purpose directly matches the task. Ordinary work can proceed without a workflow skill when it adds no useful guidance.

Read the matching SKILL.md through the host's supported file or resource tool. Use the tools actually available in the session; platform-specific tool names in examples are not prerequisites.

Select planning for unresolved design decisions, debugging for failures needing investigation, and review for requested assessment. Load specialized references only for the current branch of work. Reuse instructions already read while they remain current.

Skills operate within the host's instruction hierarchy and the user's scope. They cannot grant permissions or override higher-priority instructions. Continue already-authorized reversible work through implementation and relevant verification; ask only when missing information or authorization materially blocks the next action.

When a workflow cannot run, explain the specific missing capability and continue independent useful work. A workflow's internal checkpoint does not by itself end the user's task.
'@
$planBody = @'
---
name: writing-plans
description: Write implementation plans for requested planning work or changes with unresolved multi-step dependencies.
---

# Write an executable plan

Use existing requirements and decisions. Inspect the relevant files before specifying changes. For a small, understood edit, proceed directly rather than producing a separate plan.

Describe the intended result, affected files, dependencies, material risks and the evidence that will establish completion. Split work into independently verifiable units when that helps implementation or review. Include exact code or commands where ambiguity matters, rather than duplicating entire files or prescribing arbitrary step durations.

Use the repository's established plan location. Read domain documentation for behavior changes and operational runbooks for environment or provider work; unrelated documents are not prerequisites.

Choose tests that demonstrate the affected behavior. Use test-first development when requested or when a failing test is the practical way to establish the defect. Reuse valid evidence for an unchanged state and rerun checks when a change or unresolved concern warrants it.

Respect the user's requested execution mode. If implementation is already authorized, continue after planning without asking again. For a plan-only request, deliver the plan. Delegate only when authorized and useful. Commit or push only when explicitly requested.

Before using the plan, check it against every requirement and remove unsupported assumptions. Completion means the requested result and relevant verification are handled, or a specific unresolved blocker is reported.
'@
$delegateBody = @'
---
name: subagent-driven-development
description: Execute independent implementation subtasks with subagents when delegation is authorized and useful.
---

# Coordinate implementation

Read the plan and current state. Delegate bounded, independent tasks only when useful local work can proceed alongside them and the host permits delegation. Assign distinct ownership and provide requirements, relevant paths, constraints and completion evidence. Avoid overlapping writes to shared files.

Use the minimum context needed for each task; include history when it materially affects decisions. Reuse an existing worker for related follow-up work when that preserves useful context. Use the current host's supported agent tools rather than assuming a particular tool name.

Choose isolation according to shared-state risk. Respect existing worktrees and protected branches; creating a new worktree is not mandatory for every subtask. Workers must preserve unrelated changes and must not commit, push or perform external writes without authorization.

Review returned artifacts against requirements and inspect relevant checks. Scale review to risk: a single combined review may cover a small task; use independent specification and quality reviews when complexity warrants them. An agent's success summary alone is not proof.

Fix confirmed issues and rerun affected checks. Continue authorized work without routine permission pauses. Ask only for missing information or authorization that blocks a material next step. Deliver after all requirements and relevant verification are satisfied, or report the exact unresolved blocker.
'@
$executeBody = @'
---
name: executing-plans
description: Execute an existing implementation plan when the user authorizes its implementation.
---

# Execute the plan

Read the plan and inspect current files before changing them. Reconcile completed steps with actual state; do not repeat work solely because a new session began. Resolve stale assumptions using source and project decisions.

Execute the authorized tasks through relevant verification. Adapt mechanical steps when current evidence requires it while preserving the intended outcome. Report material deviations. Respect explicit checkpoints; otherwise continue without routine approval pauses.

Fix failures caused by the requested change. Missing dependencies or failed checks call for diagnosis, not immediate handoff. Ask only when missing information, a material design choice or authorization prevents useful progress, and continue independent work where possible.

Use the host's available task tracking and collaboration tools when helpful. Isolation and delegation are choices based on shared state, risk and authorization, not prerequisites for every plan. Preserve unrelated changes and follow the project's protected-branch rules.

Before completion, inspect the deliverable against every requirement and report verification and remaining limits. Integrate, commit or push only within the explicitly requested scope; a completed implementation does not require an unsolicited integration menu.
'@
$brainstormBody = @'
---
name: brainstorming
description: Explore requirements and design alternatives when the user requests ideation or important product decisions remain unresolved.
---

# Explore a design

Start from the user's goal, existing decisions and relevant project evidence. Identify the outcome, constraints and success criteria. For an already specified, understood change, proceed with implementation rather than restarting design discovery.

Ask a concise question when missing information materially changes the solution. Continue independent useful work while awaiting an answer. Compare alternatives when they have meaningful tradeoffs; a fixed number of alternatives is unnecessary.

Explain the recommended design at the level needed to assess it: responsibilities, data flow, failure behavior and verification where relevant. Preserve established interfaces and product conventions unless the requested change requires revisiting them. Scope improvements to the requested outcome.

Record a design in the repository's established location when it needs to survive a handoff or capture a material decision. Check for contradictions and unresolved requirements before using it. A design document does not require a commit unless the user requested one.

Respect prior authorization. For an explicit brainstorming or plan-only request, deliver the design. If building is already authorized and the remaining choices are routine and reversible, continue through implementation and relevant verification. Pause only for a material unresolved choice, required authorization, or an explicit user checkpoint.

Use text by default. Visual assistance is optional and must respect the user's preferences and available tools; never require opening a local URL to complete design discussion.
'@
$verifyBody = @'
---
name: verification-before-completion
description: Check that completion claims match current evidence when validating a deliverable or reviewing delegated work.
---

# Verify the requested result

Match each claim to evidence that covers its scope. A lint pass does not prove runtime behavior, a changed file does not prove a bug fixed, and an agent's summary does not prove its artifact is correct.

Inspect the actual deliverable and run the narrowest relevant check for the affected behavior. Read results and exit status. For a bug, establish that the original failure is addressed; use a regression test when practical. For documentation-only work, check consistency and references, plus the repository's documentation validation when available.

Reuse a prior check when the verified inputs and environment remain unchanged and the result is available. Rerun after relevant changes, failures, or unresolved concerns. The boundary of a chat message does not invalidate evidence. Broaden verification when the impact or new evidence warrants it, not on every progress update.

When checks fail, fix failures caused by the requested change and verify the affected behavior again. If a prerequisite is unavailable, state exactly what remains unverified and continue independent authorized work. Do not claim full completion for a partially verified requirement.

For delegated work, inspect the output and relevant checks independently. For a multi-step request, reconcile the final state with all requirements before declaring completion. Commit, push and other external actions remain subject to the user's authorization.
'@
foreach ($entry in Import-Csv -LiteralPath $ledgerPath) {
    if ($entry.report -eq 'vendor-source-inventory-only') { continue }
    $path = $entry.path
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Write-Warning "Inventory target no longer exists: $path"
        continue
    }
    $original = [IO.File]::ReadAllText($path)
    $updated = $original
    if ($entry.kind -eq 'SKILL.md') {
        $name = Split-Path (Split-Path $path) -Leaf
        $focusedDescriptions = @{
            'better-ui' = 'Polish existing component details such as states, borders, shadows and micro-interactions when a specific UI issue is named. Use a broader design workflow for a whole surface or visual direction.'
            'make-interfaces-feel-better' = 'Tune interaction, motion and visual details for a specific component or state. Use a broader design workflow for a whole surface or visual direction.'
            'frontend-design' = 'Create or reshape a complete frontend surface or visual direction when the user requests a new page, site or application interface.'
            'impeccable' = 'Audit or refine an existing frontend surface when the user requests a focused interface improvement; route component-level polish and typography to their specialized skills.'
            'interface-design' = 'Design structural UI systems and component interfaces for product surfaces when layout, tokens or component contracts are the decision at hand.'
            'transitions-dev' = 'Implement or review transition behavior and motion primitives when a specific transition system is the subject.'
            'transitions-polish' = 'Review transition timing and interaction polish for a specific component or state.'
            'better-layout' = 'Tune layout structure, spacing and responsive composition for a specific product surface.'
            'better-colors' = 'Convert, validate or tune color tokens and contrast for a specific color-system task.'
            'better-typography' = 'Tune fonts, type scale, text wrapping and typographic accessibility for a specific text-system task.'
            'apple-design' = 'Apply physical interaction and motion principles to a specific gesture, spring, sheet or translucent-material decision.'
            'review' = 'Review a branch, pull request or diff against its requirements and repository standards when the user requests a review.'
            'code-review' = 'Run a standards-and-spec review of a fixed diff when the user explicitly requests that review workflow.'
            'orchestrate' = 'Coordinate substantial independent work when delegation is useful and authorized; use the host coordination tools available for this session.'
            'find-docs' = 'Look up current documentation for a named library, framework, SDK, CLI or cloud service when the task needs API or setup facts.'
        }
        if ($focusedDescriptions.ContainsKey($name)) {
            $updated = Set-FrontmatterDescription $updated $focusedDescriptions[$name]
        }
        if ($path -match '\\vercel\\' -and $name -eq 'auth') {
            $updated = [regex]::Replace($updated, '(?m)^  pathPatterns:\r?\n(?:    [^\r\n]*\r?\n)+', "  pathPatterns:`n    - 'clerk.config.*'`n")
            $updated = $updated.Replace('## Clerk (Recommended — Native Marketplace Integration)', '## Clerk (when selected)')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'payments') {
            $updated = [regex]::Replace($updated, '(?m)^    - ''(?:src/)?app/api/checkout/\*\*''\r?\n', '')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'agent-browser-verify') {
            $updated = [regex]::Replace($updated, '(?m)^  bashPatterns:\r?\n(?:    [^\r\n]*\r?\n)+', "  bashPatterns: []`n")
            $updated = [regex]::Replace($updated, '(?s)  promptSignals:.*?(?=\r?\n---)', "  promptSignals:`n    phrases:`n      - 'verify with agent-browser'`n      - 'browser verification'`n      - 'check browser rendering'`n    minScore: 6")
        }
        if ($path -match '\\vercel\\' -and $name -eq 'investigation-mode') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Diagnose Vercel application failures using the strongest available evidence and continue authorized repairs. Use for runtime or deployment failures, not frustration words alone.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'verification') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Verify an affected application flow against its requirements using permitted tools. Use for requested flow verification or implementation checks; starting a server alone does not require a full audit.')
        }
        if ($name -eq 'orchestration' -and $original -match '# Orca Orchestration') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*(?:\r?\n[ \t]+[^\r\n]*)*', 'description: Coordinate task graphs, messages and agent lifecycle in an existing Orca-managed runtime or when Orca coordination is explicitly requested.')
            $updated = [regex]::Replace($updated, '(?s)Engage Orca orchestration whenever.*?state; never substitute a non-Orca subagent tool\.', 'Use this workflow for Orca-managed coordination state. For general delegation without an Orca runtime, use the current host''s authorized collaboration tools. For Orca terminal control, ownership handoffs and embedded browser operations, use orca-cli. Existing Orca tasks must retain their runtime ownership; a host subagent does not replace an Orca task or its lifecycle.')
        }
        if ($name -eq 'improve-animations') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Audit animation and motion code and prepare requested remediation plans. Use for motion audits or roadmaps, not direct implementation requests.')
            $updated = $updated.Replace('Then **stop and wait for the user to select** which findings become plans. If running non-interactively, default to the top 3–5 by leverage.', 'For an audit-only request, deliver findings. If plans are requested, use the selected scope or prioritize within the authorized scope without a repeated approval gate. If the user requests direct fixes, leave this advisor workflow and execute through the appropriate implementation workflow.')
            $updated = $updated.Replace('After the table, list 2–4 **missed opportunities**', 'When supported by evidence and relevant to the request, list **missed opportunities**')
        }
        if ($name -eq 'using-git-worktrees') {
            $updated = $updated.Replace('**If NOT ignored:** Add to .gitignore, commit the change, then proceed.', '**If NOT ignored:** Add the narrow directory entry to .gitignore when appropriate for this project, verify it is ignored, and proceed. Commit only if explicitly requested; an uncommitted ignore rule still protects local discovery.')
            $updated = $updated.Replace('2. Commit the change', '2. Verify the ignore rule; commit only if explicitly requested')
            $updated = $updated.Replace('| Directory not ignored | Add to .gitignore + commit |', '| Directory not ignored | Add the narrow ignore rule and verify; commit only when requested |')
        }
        if ($name -eq 'emil-design-eng') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Apply Emil Kowalski-inspired interaction and animation design when that approach is requested or directly relevant to a specific UI detail.')
            $updated = [regex]::Replace($updated, '(?s)## Initial Response.*?(?=## Core Philosophy)', 'Use the task and relevant component context already provided. If invoked without a target or question, ask what interaction to work on. When a target is known, proceed without a scripted greeting, promotional message or artificial waiting step.

')
        }
        if ($name -eq 'better-ui') {
            $updated = $updated.Replace('Use exactly these values:', 'When consistent with the existing motion system, an example starting point is:')
            $updated = $updated.Replace('bounce must always be `0`.', 'use the project''s spring settings and reduced-motion behavior.')
            $updated = $updated.Replace('Always use `0.96`. Never use a value smaller than `0.95`: anything below feels exaggerated.', 'Treat this value as an example, not a constraint. Match the established interaction and accessibility requirements; avoid adding motion where it does not help.')
            $updated = [regex]::Replace($updated, '(?m)^Always present changes as a markdown table[^\r\n]*', 'Report material changes and evidence concisely. Use a Before/After table when comparison helps; short prose or a list is appropriate for a small change.')
            $updated = $updated.Replace('Group all confirmed findings by principle. Use a markdown table with **Severity**, **Location**, **Before**, **After**, and **Why** columns. Never use separate "Before:" / "After:" lines.', 'Group confirmed findings when useful. Include severity, location, evidence and impact; choose a table or concise prose based on the size of the review.')
            $updated = $updated.Replace('report verification, and end with `Approve`.', 'report the scope of verification without implying an approval decision the user did not request.')
        }
        if ($name -in @('better-colors','oklch-skill')) {
            $updated = $updated.Replace('Always present color changes as a markdown table with **Before** and **After** columns. Include **every color that was changed**, not just a subset. Never list findings as separate "Before:" / "After:" lines outside of a table.', 'Report material color changes and evidence clearly. Use a Before/After table when it improves comparison; concise prose or a list is appropriate for a small change. Include all affected tokens within the requested scope.')
            $updated = $updated.Replace('Always present color changes as a markdown table with **Before** and **After** columns. Include **every color that was changed** — not just a subset. Never list findings as separate "Before:" / "After:" lines outside of a table.', 'Report material color changes and evidence clearly. Use a Before/After table when it improves comparison; concise prose or a list is appropriate for a small change. Include all affected tokens within the requested scope.')
            $updated = [regex]::Replace($updated, '(?m)^Always present color changes as a markdown table[^\r\n]*', 'Report material color changes and evidence clearly. Use a Before/After table when it improves comparison; concise prose or a list is appropriate for a small change. Include all affected tokens within the requested scope.')
            $updated = $updated.Replace('When there are no findings, omit the table, state "No actionable color findings", report verification, and end with `Approve`.', 'When there are no findings, state that result and report the verification scope without forcing a specific closing word.')
        }
        if ($name -eq 'better-typography') {
            $updated = $updated.Replace('Always present changes as a markdown table with **Before** and **After** columns. Include every change you made, not just a subset. Never list findings as separate "Before:" / "After:" lines outside of a table. Group changes by principle using a heading above each table, and keep each row focused on a single diff. Write every **After** snippet in the styling system the project already uses.', 'Report material typography changes and evidence clearly. Use a Before/After table when comparison helps; concise prose or a list is appropriate for a small change. Keep examples in the project''s existing styling system.')
        }
        if ($name -eq 'emil-design-eng') {
            $updated = $updated.Replace('When reviewing UI code, you MUST use a markdown table with Before/After columns. Do NOT use a list with "Before:" and "After:" on separate lines. Always output an actual markdown table like this:', 'When reviewing UI code, present changes and evidence in the clearest compact format. Use a Before/After table when comparison helps; prose is fine for a small review.')
        }
        if ($name -eq 'better-layout') {
            $updated = $updated.Replace('When there are no findings, omit the tables, state "No actionable layout findings", report verification, and end with `Approve`.', 'When there are no findings, state that result and report the verification scope without forcing a specific closing word.')
        }
        if ($name -eq 'writing-skills') {
            $updated = $updated.Replace('**Writing skills IS Test-Driven Development applied to process documentation.**', '**Writing skills benefits from evidence-driven iteration, but TDD is one option rather than a universal prerequisite.**')
            $updated = $updated.Replace('**REQUIRED BACKGROUND:** You MUST understand superpowers:test-driven-development before using this skill. That skill defines the fundamental RED-GREEN-REFACTOR cycle. This skill adapts TDD to documentation.', 'Use test-first evaluation when a realistic pressure scenario can falsify the skill. For a narrow wording edit or documentation-only change, inspect the result and relevant references directly.')
            $updated = $updated.Replace('When the description was changed to just "Use when executing implementation plans with independent tasks" (no workflow summary), Claude correctly read the flowchart and followed the two-stage review process.', 'A concise description should route to the skill body; the body should state only the review and evaluation depth that the current workflow needs.')
            $updated = $updated.Replace('Use skill name only, with explicit requirement markers:', 'Use skill names without file-path force-loading. Mark a supporting skill as required only when the current workflow genuinely depends on it; otherwise describe it as optional guidance:')
            $updated = $updated.Replace('- ✅ Good: `**REQUIRED SUB-SKILL:** Use superpowers:test-driven-development`', '- ✅ When required: `Use superpowers:test-driven-development when a regression test is the appropriate seam.`')
            $updated = $updated.Replace('- ✅ Good: `**REQUIRED BACKGROUND:** You MUST understand superpowers:systematic-debugging`', '- ✅ When optional: `Consult superpowers:systematic-debugging if the skill handles a difficult runtime failure.`')
        }
        if ($name -eq 'systematic-debugging') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Diagnose a difficult bug, test failure or regression with evidence and proportionate verification when the user requests debugging.')
            $updated = $updated.Replace('**Core principle:** ALWAYS find root cause before attempting fixes. Symptom fixes are failure.', '**Core principle:** establish the strongest available evidence for the cause before changing behavior. Label uncertainty and choose a proportionate mitigation when the full cause cannot yet be isolated.')
            $updated = $updated.Replace('**Violating the letter of this process is violating the spirit of debugging.**', 'Use the process as a guide; adapt it to the evidence, risk and available runtime.')
            $updated = $updated.Replace('You MUST complete each phase before proceeding to the next.', 'Complete the phases that the current failure needs; a clear evidence-backed cause may allow a phase to be shortened or skipped.')
            $updated = $updated.Replace('**If ≥ 3: STOP and question the architecture (step 5 below)**', '**If ≥ 3: examine the architecture when the repeated evidence supports that conclusion**')
            $updated = $updated.Replace('If you haven''t completed Phase 1, you cannot propose fixes.', 'If Phase 1 is incomplete, state what is known and what remains uncertain; do not overclaim the cause.')
            $updated = $updated.Replace('Use for ANY technical issue:', 'Use for difficult or ambiguous failures where systematic diagnosis is useful:')
            $updated = $updated.Replace('**BEFORE attempting ANY fix:**', '**Before changing behavior:**')
            $updated = $updated.Replace('   - MUST have before fixing', '   - Prefer a failing test when a correct seam exists; otherwise record the available evidence and verify proportionately')
            $updated = $updated.Replace('   - Use the `superpowers:test-driven-development` skill for writing proper failing tests', '   - Use a test-first workflow when a correct seam and the requested scope make it useful')
            $updated = $updated.Replace('   - STOP', '   - Return to diagnosis with the new evidence; do not repeat the same fix')
            $updated = $updated.Replace('   - DON''T attempt Fix #4 without architectural discussion', '   - Reassess cause and scope before another attempt; ask only when a material architectural decision is required')
            $updated = $updated.Replace('   **STOP and question fundamentals:**', '   **Reassess fundamentals when repeated evidence indicates an architectural problem:**')
            $updated = $updated.Replace('   **Discuss with your human partner before attempting more fixes**', '   Pause for user input only when the next step is a material decision; otherwise continue safe diagnosis')
        }
        if ($name -eq 'test-driven-development') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Use a test-first workflow when the user requests TDD or a failing test is the appropriate seam for the change.')
            $updated = $updated.Replace('**Always:**', '**Use this workflow when requested or when a valid regression seam makes it useful:**')
            $updated = $updated.Replace('**Exceptions (ask your human partner):**', '**Cases where another verification approach may be better:**')
            $updated = $updated.Replace('Thinking "skip TDD just this once"? Stop. That''s rationalization.', 'Do not force test-first development when the task has no meaningful test seam, is exploratory, or has another proportionate verification method.')
            $updated = $updated.Replace('NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST', 'When this workflow is selected, establish a failing test before implementation where a valid seam exists')
            $updated = $updated.Replace('**No exceptions:**', '**When this workflow applies:**')
        }
        if ($name -eq 'requesting-code-review') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Request an independent code review when the user asks for review or the change risk justifies it before integration.')
            $updated = [regex]::Replace($updated, '(?ms)\*\*Mandatory:\*\*.*?(?=\r?\n\r?\n\*\*Optional)', '**Use review when:**\n- The user explicitly requests it\n- The change is high-risk or a merge decision needs independent evidence\n\nDo not dispatch a reviewer for every small task or because another workflow mentions one.')
            $updated = $updated.Replace('- Review after EACH task', '- Review at a meaningful checkpoint when the task risk or user request warrants it')
            $updated = $updated.Replace('- Catch issues before they compound', '- Use findings to guide the next authorized change')
            $updated = $updated.Replace('- Review after each batch (3 tasks)', '- Review a batch when it has a coherent boundary or the risk warrants it')
            $updated = $updated.Replace('- Review after each task or at natural checkpoints', '- Review at coherent checkpoints when the task risk or user request warrants it')
            $updated = $updated.Replace('- Review before merge', '- Review before merge when requested or when the integration risk warrants independent evidence')
            $updated = $updated.Replace('independent evidence when requested or when the integration risk warrants independent evidence', 'independent evidence')
            $updated = $updated.Replace('- Skip review because "it''s simple"', '- Skip a review that the user explicitly requested or the integration risk requires')
        }
        if ($name -eq 'finishing-a-development-branch') {
            $updated = $updated.Replace('**Before presenting options, verify tests pass:**', '**Before presenting integration options, verify checks relevant to the changed behavior:**')
            $updated = $updated.Replace('npm test / cargo test / pytest / go test ./...', 'Run the project''s narrowest relevant check; broaden only when scope or evidence requires it.')
            $updated = $updated.Replace('Stop. Don''t proceed to Step 2.', 'Do not present the integration as complete while relevant failures remain. Continue authorized fixes or report the blocker.')
            $updated = $updated.Replace('**Always:**', '**When relevant:**')
            $updated = $updated.Replace('**Core principle:** Verify tests → Present options → Execute choice → Clean up.', '**Core principle:** Verify relevant checks → Present only requested integration choices → Execute the authorized choice → Clean up.')
            $updated = $updated.Replace('**Announce at start:** "I''m using the finishing-a-development-branch skill to complete this work."', 'Use the integration workflow when the user asks to merge, publish, or clean up a completed branch.')
            $updated = $updated.Replace('Tests failing (<N> failures). Must fix before completing:', 'Tests failing: fix failures caused by this change or report unrelated failures before integration:')
            $updated = $updated.Replace('- **Fix:** Always verify tests before offering options', '- **Fix:** Verify checks relevant to changed behavior before offering integration options')
        }
        if ($name -in @('review','code-review')) {
            $updated = $updated.Replace('Both axes run as **parallel sub-agents** so they don''t pollute each other''s context, then this skill aggregates their findings.', 'Review the standards and spec axes independently when that improves confidence. A small diff may use one combined pass; delegation is optional and must use the host''s available tools.')
            $updated = $updated.Replace('Both axes run as **parallel sub-agents** so they don''t pollute each other''s context, then this skill aggregates their findings.', 'Review the standards and spec axes independently when that improves confidence. A small diff may use one combined pass; delegation is optional and must use the host''s available tools.')
        }
        if ($name -eq 'create-auth-skill') {
            $updated = $updated.Replace('### Step 2: Ask planning questions', '### Step 2: Ask only unresolved planning questions')
            $updated = $updated.Replace('Use the `AskQuestion` tool to ask the user **all applicable questions in a single call**. Skip any question you already have a confident answer for from the scan.', 'Use the host''s available input capability to ask only questions whose answers are not established by the scan, project configuration or the user''s request. Ask in one concise batch when that reduces friction; follow up only when a dependency requires it.')
            $updated = $updated.Replace('4. **Authentication methods** (always ask, allow multiple)', '4. **Authentication methods** (ask only if not already specified)')
            $updated = $updated.Replace('8. **Features & plugins** (always ask, allow multiple)', '8. **Features & plugins** (ask only for unresolved scope, allow multiple)')
            $updated = $updated.Replace('9. **Auth pages** (always ask, allow multiple — pre-select based on earlier answers)', '9. **Auth pages** (ask only for unresolved product scope; pre-select from known answers)')
            $updated = $updated.Replace('10. **Auth UI style** (always ask)', '10. **Auth UI style** (ask only when visual direction is unresolved)')
        }
        if ($name -eq 'make-interfaces-feel-better') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Apply interaction, motion and visual-polish guidance when a specific UI detail is being built or reviewed.')
            $updated = $updated.Replace('Use exactly these values:', 'Use values appropriate to the existing motion system; the following are examples only:')
            $updated = $updated.Replace('bounce must always be `0`.', 'preserve the project''s spring settings and reduced-motion behavior.')
            $updated = $updated.Replace('Always use `0.96`. Never use a value smaller than `0.95` — anything below feels exaggerated.', 'Treat `scale(0.96)` as an optional starting point. Match the existing interaction system and avoid motion where it distracts or harms accessibility.')
            $updated = [regex]::Replace($updated, '(?m)^Always present changes as a markdown table[^\r\n]*', 'Report material changes and evidence clearly. Use a Before/After table when comparison helps; concise prose or a list is appropriate for a small change.')
            $updated = [regex]::Replace($updated, '(?m)^When there are no findings, omit the findings table,[^\r\n]*', 'When there are no findings, state that result and report the verification scope without forcing a specific closing word.')
        }
        if ($path -match '\\(better-ui|make-interfaces-feel-better)\\animations\.md$') {
            $updated = [regex]::Replace($updated, '(?m)^\*\*Important:\*\* Always use exactly these values[^\r\n]*', '**Suggested starting values:** Adapt these to the existing motion system, component state and reduced-motion requirements; do not treat examples as fixed constraints.')
            $updated = $updated.Replace('- `scale`: `0.25` → `1` (never use `0.5` or `0.6`)', '- `scale`: choose a restrained range appropriate to the icon and surrounding layout')
            $updated = $updated.Replace('- `transition`: `{ type: "spring", duration: 0.3, bounce: 0 }`; **bounce must always be `0`**, never `0.1` or any other value', '- `transition`: use the project''s established spring or CSS timing; keep motion accessible')
            $updated = $updated.Replace('- `transition`: `{ type: "spring", duration: 0.3, bounce: 0 }` — **bounce must always be `0`**, never `0.1` or any other value', '- `transition`: use the project''s established spring or CSS timing; keep motion accessible')
            $updated = [regex]::Replace($updated, '(?m)^A subtle scale-down on click gives buttons tactile feedback\. Always use `scale\(0\.96\)\. Never use a value smaller than `0\.95`[^\r\n]*', 'A restrained scale-down can provide tactile feedback. Choose a value that fits the existing component system and reduced-motion behavior; use CSS transitions for interruptibility.')
            $updated = [regex]::Replace($updated, '(?m)^A subtle scale-down on click gives buttons tactile feedback\. Always use `0\.96`\. Never use a value smaller than `0\.95`[^\r\n]*', 'A restrained scale-down can provide tactile feedback. Choose a value that fits the existing component system and reduced-motion behavior; use CSS transitions for interruptibility.')
        }
        if ($name -eq 'impeccable') {
            $updated = $updated.Replace('You MUST do these steps before proceeding:', 'Use the setup steps that are relevant to the requested workflow before editing.')
            $updated = $updated.Replace('**Required even when you''ve loaded a sub-command reference in step 2.**', 'Inspect a representative project file when editing so the change follows existing conventions.')
            $updated = $updated.Replace('**This is non-optional; skipping it produces generic output.**', 'Read the matching register when the task needs its guidance; skip unrelated registers.')
            $updated = $updated.Replace('Take no shortcuts unless the user asks for them (when in doubt, ask). Don''t stop until arriving at a complete implementation (beautiful, responsive, fast, precise, bug-free, on brand).', 'Aim for the requested outcome with checks proportionate to its scope. Continue while relevant defects or unverified requirements remain; ask only when a material decision is unresolved.')
            $updated = [regex]::Replace($updated, '(?m)^- Verify in bounded passes, not a loop,[^\r\n]*', '- Batch relevant inspections and fixes. Stop when the requested behavior and quality criteria are verified. Further passes require a confirmed defect, a relevant change or unresolved evidence; avoid speculative polishing, but do not leave required fixes incomplete to satisfy a fixed pass count. Use only inspection methods permitted by the user and host.')
            $updated = $updated.Replace('When there are no findings, omit the findings table, state "No actionable interface-polish findings", report verification and rejected candidates, and end with `Approve`.', 'When there are no findings, state that result and report the verification scope without forcing a specific closing word.')
        }
        if ($name -eq 'improve-ui') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Audit an existing interface against its design evidence and prepare requested implementation handoff plans. Use for review or planning requests, not direct implementation.')
            $updated = $updated.Replace('If asked to fix or improve directly, offer a plan; never implement it.', 'If the user asks for direct implementation, this audit-only workflow no longer applies. Continue through the appropriate implementation workflow within the authorized scope; do not substitute a plan for the requested fix.')
        }
        if ($name -eq 'orchestrate') {
            $updated = $updated.Replace('Remain available to the user while delegating substantive work. Run narrow, read-only scouts in parallel with `reasoning_effort: "low"` and `fork_turns: "none"`. Use `reasoning_effort: "medium"` for routine implementation and `"high"` for difficult work. Give each agent distinct ownership, prevent overlapping assignments, and instruct leaf workers not to delegate. Integrate the results and keep approvals with the user.', 'Delegate only when the work is genuinely independent, the host supports it and delegation is authorized or clearly useful. Give each worker distinct ownership, prevent overlapping writes and integrate actual artifacts. Use the host''s supported model and collaboration settings; do not impose reasoning levels or parallelism on every task. Keep approval decisions with the user.')
        }
        if ($name -eq 'diagnosing-bugs') {
            $updated = $updated.Replace('If you don''t have one, no amount of staring at code will save you.', 'When a runnable reproduction is unavailable, source analysis and captured evidence can still establish a defect or a falsifiable hypothesis; distinguish those conclusions from runtime verification.')
            $updated = [regex]::Replace($updated, '(?m)^Stop and say so explicitly\. List what you tried\.[^\r\n]*', 'State why a runnable loop is unavailable and what was tried. Continue with available source, configuration and redacted artifacts. Ask for additional access or evidence only when it materially blocks diagnosis; production instrumentation needs authorization. Label hypotheses and any remaining runtime uncertainty.')
            $updated = [regex]::Replace($updated, '(?s)### Completion criterion: a tight loop that goes red.*?(?=## Phase 2:)', '### Completion criterion: evidence for the failure

Prefer a focused command that demonstrates the exact symptom and can verify the fix. When that is unavailable, record a concrete static proof or captured failure, its assumptions and the next check that could falsify the hypothesis. A missing runtime must not force speculation or prevent useful source investigation.

')
            $updated = $updated.Replace('Do not proceed until you have reproduced **and** minimised.', 'When reproduction is available, minimize enough to distinguish causes. Otherwise continue from the documented evidence and retain the runtime verification limitation.')
            $updated = $updated.Replace('Run the loop. Watch it go red as the bug appears.', 'If a runnable loop is available, run it and confirm the reported failure. Otherwise use the documented static or captured evidence without claiming a runtime reproduction.')
            $updated = $updated.Replace('Generate **3–5 ranked hypotheses** before testing any of them.', 'Generate the plausible hypotheses supported by evidence, ranked by likelihood and impact. Do not invent extra hypotheses to meet a fixed count.')
        }
        if ($name -eq 'sites-building') {
            $updated = $updated.Replace('Where the environment supports a user-facing local preview, treat it as an early milestone in both execution paths.', 'Where the environment supports a user-facing local preview and the user permits local URLs, treat it as an optional early milestone in both execution paths.')
            $updated = $updated.Replace('In a visible foreground thread with local preview support, open it as soon as, but not before, all of these are true:', 'When a local preview handoff is permitted, open it only after all of these are true:')
            $updated = $updated.Replace('For a supported local preview, once the bounded slice is applied, make no further planned product-source edits before the handoff.', 'For a permitted local preview handoff, show the coherent slice when useful. A skipped or unavailable handoff does not block further product-source edits.')
            $updated = $updated.Replace('In a visible foreground thread with user-facing local preview support, the **First meaningful preview** gate is the only local opening point.', 'When the user permits local URLs in a visible foreground thread, the **First meaningful preview** gate is the local opening point. Otherwise skip the handoff and continue using permitted checks.')
        }
        if ($name -eq 'sites-hosting') {
            $updated = $updated.Replace('Commit the exact validated source. Push it with the returned credential as a per-command HTTP authorization header.', 'When source commit and push are authorized, commit the exact validated source and push it with the returned credential as a per-command HTTP authorization header. If project instructions require explicit commit/push authorization and it is absent, finish local validation and present the exact publishing requirement before this step; do not assume hosting intent overrides that restriction.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'shadcn') {
            $updated = $updated.Replace('> **AI Elements compatibility**: Always use `--base radix` (the default) when the project uses or may use AI Elements. AI Elements components rely on Radix APIs and have type errors with Base UI.', '> **Component compatibility**: Preserve the project''s selected primitives. Before adding an AI Elements component, check its installed-version requirements and choose a compatible implementation. A possible future use does not justify switching libraries; a migration requires a material architectural decision within the requested scope.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'ai-generation-persistence') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Design durable AI generation history when the product requires retrieval, resumable sessions or saved artifacts.')
            $updated = $updated.Replace('**AI generations are expensive, non-reproducible assets. Never discard them.**', '**Persist generations according to the product contract and retention policy.**')
            $updated = $updated.Replace('Every call to an LLM costs real money and produces unique output that cannot be exactly reproduced. Treat generations like database records — assign an ID, persist immediately, and make them retrievable.', 'For saved history or reusable artifacts, assign an identity and provide authorized retrieval. Ephemeral responses may remain unsaved. Determine what content and metadata may be retained, who may access it and when it must expire or be deleted before applying the durable patterns below.')
            $updated = $updated.Replace('**Persist every generation** — text and metadata to database, images and files to Vercel Blob', '**Persist required artifacts** — use the existing database and object store; minimize retained content and enforce retention limits')
            $updated = $updated.Replace('**Make every generation addressable**', '**Make saved generations addressable to authorized users**')
            $updated = $updated.Replace('**Track metadata** — model name, token usage, estimated cost, timestamp, user ID', '**Track needed metadata** — retain only the usage and identity fields required by the product and privacy policy')
            $updated = $updated.Replace('**Never stream without saving** — if the user refreshes, the generation must survive', '**Save when continuity is required** — support refresh/reconnect for durable sessions; allow explicitly ephemeral responses')
            $updated = $updated.Replace('## Anti-Patterns', '## Pitfalls for durable history (not ephemeral responses)')
            $updated = $updated.Replace('Always write to DB as tokens arrive or on completion.', 'For durable sessions, save at appropriate checkpoints or completion, subject to retention and access controls.')
            $updated = $updated.Replace('always store model name, token counts, and timestamp.', 'store the fields required for the approved diagnostics and cost accounting.')
            $updated = $updated.Replace('Never serve generated images as ephemeral base64 or temporary URLs. Save to Blob immediately:', 'For images that must be retained, save to the selected object store and serve an authorized URL. Ephemeral previews do not require permanent storage:')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'vercel-queues') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Configure and troubleshoot Vercel Queues topics, consumers, retries and delivery when this queue service is selected or already integrated.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'deployments-cicd') {
            $updated = $updated.Replace('1. **Always use `--prebuilt` in CI** — separates build from deploy, enables build caching and test gates', '1. **Follow the project release strategy** — use `--prebuilt` when the pipeline intentionally builds artifacts before deployment. Preserve native builds and manual promotion flows when those are the established contract.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'knowledge-update') {
            $updated = [regex]::Replace($updated, '(?m)^When a build needs an external service[^\r\n]*', 'For a task involving external services, inspect the existing architecture and selected providers first. Consult marketplace guidance when a new Vercel Marketplace integration is requested or required by that architecture. Questions, audits and local changes do not require provisioning. Respect existing accounts, credentials and authorization; clearly distinguish configured integrations from examples or mocks.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'marketplace') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Discover and manage Vercel Marketplace integrations when marketplace provisioning is requested or needed for the selected architecture.')
            $updated = [regex]::Replace($updated, '(?s)\*\*Before you scaffold or write any file:.*?## Category map', '## Choose and provision an integration

Inspect existing providers and the requested architecture first. Reuse configured integrations. Marketplace provisioning is not required for read-only advice, local fixes, or applications already using another provider.

When a new integration is needed, discover relevant options and compare compatibility, capabilities, region, cost and account requirements. A result''s ranking does not establish suitability. Preserve an explicitly selected provider; ask only when a material choice cannot be inferred.

Provision the chosen integration within the authorized scope using the current CLI documentation. Complete account consent when required and protect existing environment files before pulling configuration. Continue independent implementation while unavailable account steps are pending. Distinguish working integrations from mocks or unconfigured examples in the result.

Use dedicated storage, authentication or AI guidance only when that capability is part of the task. SDK installation is appropriate for the chosen integration when implementation requires it; it is not necessary merely to answer a question.

## Category map')
        }
        if ($name -eq 'neon-postgres') {
            $updated = $updated.Replace('Always pair Neon with an ORM such as **Drizzle** for easy schema management and migrations.', 'Preserve the project''s SQL access and migration approach. An ORM such as Drizzle is an option when it meets the requirements, not a prerequisite for Neon.')
        }
        if ($name -eq 'react-email') {
            $updated = $updated.Replace('**Important:** Always ask the user for their production hosting URL. Do not hardcode `localhost:3000`.', '**Hosting URL:** Use the production URL already provided or verified in project configuration. Ask only if it is missing or ambiguous. Do not substitute a localhost URL for production links.')
        }
        if ($name -eq 'plugin-management') {
            $updated = [regex]::Replace($updated, '(?s)Call `search_plugins`.*?Suggestions do not block the task\.', 'Discover the plugin search or management capability exposed by the current host and read its schema before calling it. Search by concise provider or capability names when search is available. If the host offers only a recommended list, state that discovery is limited to that list rather than pretending to search a complete directory.

Use installation or suggestion tools only under their actual preconditions. In Codex, request_plugin_install requires an explicitly requested plugin, exhausted tool discovery and an exact entry in the recommended list. A useful adjacent capability does not satisfy those conditions. Preserve existing connections and avoid duplicate requests.

Suggestions do not block the task.')
            $updated = [regex]::Replace($updated, '(?s)- Use `get_app_permissions`.*?without inventing an identifier\.', '- Inspect permissions and dependencies through available read-only capabilities when the host exposes them. Report unavailable operations accurately.
- Change permissions only within the user''s requested scope. Resolve material ambiguity before a mutation.
- Remove a plugin only when explicitly requested, using the host''s uninstall tool and its identifier rules. Do not substitute app removal for plugin removal or invent tool names.')
        }
        if ($path -match '\\pstack-codex\\' -and $name -eq 'unslop') {
            $updated = $updated.Replace('Cut AI tells from any writing. Must always apply.', 'Remove formulaic language from writing when this editing workflow is requested.')
        }
        if ($path -match '\\pstack-codex\\' -and $name -eq 'principle-sequence-verifiable-units') {
            $updated = [regex]::Replace($updated, '(?m)^\*\*Execution\.\*\*[^\r\n]*', '**Execution.** Group changes into units whose behavior can be checked meaningfully. Batch independent, low-impact edits when a shared check covers them; isolate risky transitions for earlier verification. Preserve the current checkout and user changes. Rebase only when required by the requested integration workflow and authorized for that branch.')
            $updated = $updated.Replace('**Delivery.** Stack commits and PRs in the order that proves the work.', '**Delivery.** When commits or PRs are requested, organize them in an order that makes the change reviewable.')
            $updated = $updated.Replace('- Verify before advancing. Red to green per unit, never deferred to a final batch.', '- Verify affected behavior at meaningful boundaries; repeat checks after relevant changes rather than after every mechanical edit.')
        }
        $providerDescriptions = @{
            'neon' = 'Route Neon project setup, branching and service operations when Neon is selected, already integrated, or explicitly being evaluated.'
            'neon-ai-gateway' = 'Configure or troubleshoot Neon AI Gateway when that gateway is selected or already used by the project.'
            'neon-functions' = 'Build and operate Neon Functions for projects using or explicitly adopting Neon compute.'
            'neon-object-storage' = 'Configure Neon Object Storage buckets and file operations when Neon storage is selected or already integrated.'
        }
        if ($providerDescriptions.ContainsKey($name)) {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*(?:\r?\n(?:[ \t]+[^\r\n]*|(?=\r?$)))*', ('description: ' + $providerDescriptions[$name]))
            $updated = $updated.Replace('**FIRST**: Use the parent `neon` skill for a Neon overview, getting started with Neon, Neon development best practices, and more.', 'Consult the parent `neon` skill when setup or branch context is missing. Reuse relevant context already available; load only the section needed for this operation.')
        }
        if ($path -match '\\vercel\\' -and $name -in @('auth','payments')) {
            $description = if ($name -eq 'auth') {'Configure Clerk, Descope or Auth0 authentication when that provider is selected or already integrated. Preserve other existing authentication providers.'} else {'Implement Stripe checkout, billing and webhooks when Stripe is selected or already integrated. Preserve other existing payment providers.'}
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', ('description: ' + $description))
        }
        if ($path -match '\\vercel\\' -and $name -eq 'verification') {
            $updated = $updated.Replace('You find the **first broken boundary** — report it with evidence and a specific fix, do not continue past the break', 'You find a broken boundary in a diagnosis-only request — report evidence and the proposed fix. When correction is authorized, fix the cause and resume verification of the affected flow')
            $updated = $updated.Replace('Two consecutive layers return no useful signal (e.g., no logs, no errors, no output) — flag the observability gap and recommend adding logging before continuing', 'Required evidence is unavailable — state the specific limitation, use other permitted evidence where useful, and continue independent authorized work')
            $updated = $updated.Replace('Run the same check more than twice', 'Repeat an unchanged check without new evidence; rerun after relevant corrections')
            $updated = $updated.Replace('Continue past a confirmed broken boundary', 'Treat downstream success as proven while an upstream failure prevents observing it')
            $updated = $updated.Replace('## Suggest Verification After Implementation', '## Verify After Implementation')
            $updated = $updated.Replace("When you finish building or implementing a feature (wrote code, created routes, set up a project), briefly let the user know they can ask you to verify everything works — e.g. browser verification or end-to-end flow check. One sentence is enough. Don't force it if only a small fix or question was involved.", 'After implementation, perform verification proportionate to the affected behavior using permitted tools. Reuse valid evidence from unchanged inputs. Browser inspection must respect user preferences; report any unverified visual behavior. Do not require a separate request to verify work already authorized.')
        }
        if ($path -match '\\vercel\\' -and $name -in @('agent-browser','agent-browser-verify')) {
            $updated = $updated.Replace(' Also triggers when a dev server starts so you can verify it visually.', ' Use browser verification only when relevant and permitted by the user and host.')
            if ($name -eq 'agent-browser-verify') {
                $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Verify rendered dev-server behavior with agent-browser when browser inspection is relevant and permitted. Respect restrictions on local URLs.')
                $updated = $updated.Replace('**You MUST verify the dev server with agent-browser after starting it.** Do not assume the page works just because the dev server process started. Many issues (blank pages, hydration errors, missing env vars, broken imports) are only visible in the browser. Run this verification before continuing with any other work:', 'Use this browser flow when rendered behavior needs inspection and the user permits access to the target URL. Starting a server alone does not require browser automation. If local URLs or browser use are restricted, skip this flow, use permitted checks and state which visual behavior remains unverified. A running process alone is not evidence that the page renders correctly.')
            }
        }
        if ($name -eq 'visualize') {
            $updated = [regex]::Replace($updated, '(?m)^- Work silently unless blocked[^\r\n]*\r?\n  send commentary[^\r\n]*\r?\n  updating the file;[^\r\n]*', '- Follow the host communication requirements. Keep progress updates concise and relevant to the result.')
            $updated = [regex]::Replace($updated, 'visual\. Never announce this skill, a visualization surface, widgets, HTML,\r?\n  SVG, scripts, local files, inline data, or implementation details\.', 'visual. Include implementation details only when they help the user understand or use the result.')
            $updated = $updated.Replace('Copy into every compaction summary:', 'If compaction loses needed output-contract details, consult the relevant section again. Preserve the artifact path and completed work in the summary:')
            $updated = $updated.Replace('`Reload the full visualize skill before creating or updating a visualization.`', '`Reuse the existing visualization artifact and consult only missing contract details before updating it.`')
        }
        if ($path -match '\\vercel\\' -and $path -match '\\ai-sdk\\(upstream\\)?SKILL.md$') {
            $updated = $updated.Replace('Before searching docs, check if `node_modules/ai/docs/` exists. If not, install **only** the `ai` package using the project''s package manager (e.g., `pnpm add ai`).', 'Read installed-version documentation in `node_modules/ai/docs/` when available. Otherwise retrieve the official documentation without installing a package solely to read it. Install dependencies only when needed for the authorized implementation.')
            $updated = [regex]::Replace($updated, '(?m)^7\. \*\*Always fetch current model IDs\*\*[^\r\n]*', '7. **Verify the chosen model** - Preserve an explicit user model and provider. Confirm its identifier and required capabilities against that provider''s current documentation or catalog. When unspecified, choose by capability, availability, latency and cost; the largest version number alone is not a selection criterion.')
            $updated = $updated.Replace('**Always use this model, never older gemini-2.x models**', 'Example only; use the requested image-capable model after confirming its current API')
            $updated = [regex]::Replace($updated, '(?m)^\*\*Model slug rules\*\*:[^\r\n]*', '**Model identifiers:** Use the exact identifier format of the selected provider or gateway. Preserve the model requested by the user; verify availability before changing it.')
            $updated = [regex]::Replace($updated, '(?m)^1\. \*\*Default to AI Gateway with OIDC\*\*[^\r\n]*', '1. **Preserve the selected provider and authentication** - Use Vercel AI Gateway and its documented authentication when already integrated or selected for this task. Direct provider integrations do not require migration to a gateway.')
        }
        if ($path -match '\\vercel\\' -and $name -eq 'ai-elements') {
            $updated = [regex]::Replace($updated, '(?m)^description:[^\r\n]*', 'description: Compose and troubleshoot AI Elements components in projects using or explicitly adopting that library.')
            $updated = [regex]::Replace($updated, '(?m)^\*\*AI Elements is mandatory[^\r\n]*', 'Use AI Elements when selected for this interface or already integrated. Preserve the existing rendering system otherwise. Plain text and Markdown require different rendering choices; neither mandates this library.')
            $updated = [regex]::Replace($updated, '(?m)^\*\*Never render AI text as raw JSX\*\*[^\r\n]*', 'Render plain text as text. When the response contract includes Markdown, use the project''s Markdown renderer; in AI Elements projects, MessageResponse is the relevant component.')
            $updated = $updated.Replace('Yes — models always produce markdown, use `<MessageResponse>`', 'Optional; use the renderer appropriate to the response contract')
            $updated = [regex]::Replace($updated, '(?m)^5\. \*\*shadcn must use Radix base\*\*[^\r\n]*', '5. **Check primitive compatibility** - Verify the installed AI Elements component against the project''s UI primitives. Resolve compatibility locally or choose a compatible component; changing the project''s primitive library requires an explicit architectural decision.')
        }
        if ($path -match '\\vercel\\' -and $name -in @('investigation-mode','observability')) {
            $updated = $updated.Replace('Follow the triage order, report what you find at every step, and stop when you have a high-confidence root cause.', 'Choose the next diagnostic step from the observed failure and available evidence. Report meaningful findings. Once the cause is established, continue the authorized correction and verification; diagnosis-only requests end with the findings.')
            $updated = $updated.Replace('Work through these in order. Stop as soon as you find the root cause.', 'Use the relevant steps below in the order justified by evidence. Finding the cause completes diagnosis, not an authorized repair task.')
            $updated = $updated.Replace('- **If no logs exist**: This is the problem. Add logging before continuing (see "Add Logging" below)', '- **If no logs exist**: Treat this as a limit of that evidence source, not proof of the cause. Inspect errors, tests, source or configuration next. Add focused instrumentation only when needed to distinguish hypotheses.')
            $updated = $updated.Replace('**Always start with logging.** When something is stuck, slow, or broken, the first step is always to check or add logs.', 'Use existing logs when they illuminate the failure. Tests, source, configuration and runtime errors may provide stronger evidence; add instrumentation only to resolve a concrete diagnostic gap.')
        }
        if ($name -eq 'using-superpowers' -and $original -match '1% chance') {
            $updated = $usingBody + "`n"
        } elseif ($name -eq 'writing-plans' -and $original -match 'Frequent commits|frequent commits') {
            $updated = $planBody + "`n"
        } elseif ($name -eq 'brainstorming' -and $original -match 'Every project goes through this process|EVERY project|HARD-GATE') {
            $updated = $brainstormBody + "`n"
        } elseif ($name -eq 'verification-before-completion' -and $original -match 'The Iron Law|NO COMPLETION CLAIMS WITHOUT FRESH') {
            $updated = $verifyBody + "`n"
        } elseif ($name -eq 'executing-plans' -and $original -match 'REQUIRED SUB-SKILL|Required workflow skills') {
            $updated = $executeBody + "`n"
        } elseif ($name -eq 'subagent-driven-development' -and $original -match 'two-stage review|Two-stage review') {
            $updated = $delegateBody + "`n"
        } elseif ($name -eq 'gh-fix-ci') {
            $updated = $updated.Replace('Summarize the root cause first, propose a focused fix plan, and implement only after explicit approval.', 'Summarize the root cause and implement the focused local fix when the user requested correction. Ask only for missing authorization or a material scope decision; diagnosis-only requests end with findings.')
            $updated = $updated.Replace('6. Propose a focused fix plan and wait for approval.', '6. Identify the focused fix within the requested scope.')
            $updated = $updated.Replace('7. Implement after approval.', '7. Implement the authorized correction.')
            $updated = $updated.Replace('Suggest re-running the relevant tests and `gh pr checks`.', 'Run the relevant tests and read `gh pr checks` when available; distinguish local verification from remote CI state. Commit and push only when explicitly requested.')
        }
    } elseif ($entry.kind -eq 'AGENTS.md' -and $original -match '## Project Documentation|## Project Memory') {
        $updated = $updated.Replace('* If the block above is empty, run `ls -1tr aidd_docs/memory/` and read each file.', '* When task context is missing, inspect the memory index or filenames and read only the entries relevant to the affected domain. An empty memory block does not require loading every file.')
        $directory = Split-Path $path
        if (Test-Path -LiteralPath (Join-Path $directory 'docs/README.md')) {
            $updated = $updated.Replace('More specific local docs under `aidd_docs/`.', 'Relevant canonical documents indexed in `docs/README.md`.')
            $updated = $updated.Replace('Start with `docs/README.md` and follow its reading path.', 'Use `docs/README.md` to locate the domain or operational guide relevant to the task. Read broader product and architecture context when the change crosses those boundaries.')
        }
        $updated = $updated.Replace('At task boundaries, inspect and report the status of worktrees, branches, stashes, uncommitted changes, and open Pull Requests; every retained item needs an owner or a documented reason to remain.', 'For requested repository cleanup or release handoff, inspect worktrees, branches, stashes, uncommitted changes, and open Pull Requests; explain why retained cleanup candidates remain. For other tasks, inspect only state relevant to safe execution.')
    }
    if ($entry.kind -eq 'AGENTS.md' -and $original.Contains('`useEffectEvent` provides a cleaner API for the same pattern: it creates a stable function reference')) {
        $updated = $updated.Replace('`useEffectEvent` provides a cleaner API for the same pattern: it creates a stable function reference that always calls the latest version of the handler.', '`useEffectEvent` reads current values for events fired from Effects. Its function identity intentionally changes on each render; it is not a general stable-callback replacement. Call it only from Effects or other Effect Events, omit it from dependency arrays, and do not pass it to other components or Hooks. See https://react.dev/reference/react/useEffectEvent.')
        $updated = $updated.Replace('useEffectEvent for Stable Callback Refs', 'useEffectEvent for Events from Effects').Replace('useeffectevent-for-stable-callback-refs', 'useeffectevent-for-events-from-effects')
        $updated = $updated.Replace('Access latest values in callbacks without adding them to dependency arrays. Prevents effect re-runs while avoiding stale closures.', 'Use Effect Events only for genuinely non-reactive event logic fired from an Effect. Keep reactive dependencies that control synchronization. The example below applies when changing onSearch alone should not restart the pending search; otherwise keep onSearch reactive.')
    }
    if ($updated -eq $original) { continue }
    $before = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
    if ($Apply) {
        [void][IO.Directory]::CreateDirectory($backupRoot)
        $backup = Join-Path $backupRoot ($before + '.txt')
        if (-not (Test-Path -LiteralPath $backup)) { [IO.File]::Copy($path, $backup) }
        [IO.File]::WriteAllText($path, $updated, [Text.UTF8Encoding]::new($false))
    }
    $changes.Add([pscustomobject]@{path=$path;before=$before;after=if($Apply){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash}else{'preview'};backup=(Join-Path $backupRoot ($before+'.txt'))})
}
if ($Apply -and $changes.Count -gt 0) {
    $changes | Export-Csv -NoTypeInformation -Encoding utf8 -Append -LiteralPath (Join-Path $PSScriptRoot '2026-09-06-remediation-changes.csv')
}
$changes | Select-Object path,before,after | ConvertTo-Json
