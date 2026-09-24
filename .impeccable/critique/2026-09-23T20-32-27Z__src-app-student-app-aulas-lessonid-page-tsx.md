---
target: sidebar direito da aula do aluno
total_score: 28
max_score: 40
na_heuristics:
p0_count: 0
p1_count: 0
target_identity: "file:C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\app\\(student)\\app\\aulas\\[lessonId]\\page.tsx"
target_fingerprint: "sha256:f253786068d11878536f3c7676f8f6b145070793cbc5d9fb8fa48c9ae6e21ed2"
target_path: "C:\\Users\\Junior\\.config\\superpowers\\worktrees\\hub\\small-changes\\src\\app\\(student)\\app\\aulas\\[lessonId]\\page.tsx"
timestamp: 2026-09-23T20-32-27Z
slug: src-app-student-app-aulas-lessonid-page-tsx
closed: true
---
Method: dual-agent (A: 01a0cfe1-230c-79d3-8956-729b3bdbb2b4 · B: 01a0cfe1-272f-7353-8fde-b0b908595bb6)

## Scope and evidence

Reviewed the student lesson sidebar at /app/aulas/[lessonId]: progress summary, module accordion, lesson states, and the mobile outline reusing the same list. The user attachment is a reference only, not a capture of the Hub. The project forbids opening local URLs; therefore rendered spacing, contrast and visual hierarchy were not inspected. This critique is based on source, product/design contracts and the user-reported visibility issue.

## Design language

- Surface: learner course sidebar and mobile summary.
- Sources: DESIGN.md; docs/domain/learning-content-and-progress.md; ADR-0011 (optional lessons); ADR-0010 (relative module release).
- Decisions: course progress counts active required lessons; optional lessons do not count or block sequence; module time-release is distinct from completion; locked lessons are static, without links or focus.
- Runtime owners: LessonCourseSidebar, LessonCourseOutline, LessonSidebarItem in src/app/(student)/app/aulas/[lessonId]/page.tsx; ModuleWithLessons/mapModules in src/features/courses/server.ts; SidebarMenuLink and Accordion shared UI.
- Explicit exceptions: none documented.

## Design Health Score

Provisional, source-based score; not a rendered UI inspection.

| Heuristic | Score | Evidence |
|---|---:|---|
| Visibility of system status | 3/4 | Progress bar, percentage, completion text and locks; current lesson marker matches other available lessons. |
| Match system and real world | 3/4 | Course, module, lesson, completion and lock are familiar concepts. |
| User control and freedom | 3/4 | Accordion navigation and direct links to available lessons; locked lessons are not actionable. |
| Consistency and standards | 3/4 | Shared Hub components, but completion is a glyph while other states use icons. |
| Error prevention | 3/4 | Locked items are static, without link or focus. |
| Recognition rather than recall | 2/4 | The check is subtle; the current lesson marker is not distinct from other available lessons. |
| Flexibility and efficiency | 3/4 | Current module opens initially and available lessons are directly navigable. |
| Aesthetic and minimalist design | 3/4 | Structure is lean in source; rendered details were not inspected. |
| Error recovery | 3/4 | Release date or sequence status is shown at module level. |
| Help and documentation | 2/4 | Summary does not say that optional lessons are excluded from progress. |
| Total | 28/40 — Good | Coherent base; needs precise status and progress semantics. |

Cognitive load: moderate, with two frictions: the current lesson is distinguished mainly by row styling, and the progress percentage does not state its denominator. Accordion grouping reduces the visible list.

## Design specificity verdict

The structure is appropriate to the Hub and does not need a redesign. The opportunity is to finish the state language using existing semantic tokens: olive for learning completion, orange for active progress, neutral for available, and a lock for unavailable. The attached list suggests a good status vocabulary, but its exact colors and numbering should not be copied.

## What's working

1. Progress summary sits above the course outline, keeping context and navigation together.
2. The current lesson link already receives aria-current=page and active styling; its module opens initially.
3. Modules group lessons, mobile reuses the same outline, and locked lessons are not links.

## Priority issues

### 1. [P2] Lesson markers do not distinguish completion, current and available states

Evidence: getLessonMarker returns the literal check glyph for completed lessons and a bullet for every available lesson. The current lesson has active row styling and aria-current, but its marker is still the same as other available lessons. The visible “Concluída ·” prefix also competes with the title.

Correction: use a small consistent status system: CheckmarkCircle02Icon with learning-complete for completed; a distinct progress-active marker for the current incomplete lesson while preserving active row styling and aria-current; a neutral circle for available, not current or completed; and the existing lock for unavailable. Completion and current-location are independent: a completed lesson can remain current. Do not label every available lesson “not started”, because the outline does not prove that it was never opened. Once the check icon is clear, the duplicate visible prefix may be removed while keeping an accessible completion label.

Moodle course index marks completed activities with a circle; Teachable combines progress, curriculum, checkmarks and distinct clock/lock states. WCAG says color must not be the only visual cue. Sources: https://docs.moodle.org/502/en/Using_Activity_completion ; https://support.teachable.com/en/articles/11682425-navigate-and-view-course-content ; https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html

### 2. [P2] Progress denominator is implicit; module completion needs server data

Evidence: the course percentage is computed over required lessons, while lessonsCount includes all lessons. Thus 100% can coexist with optional lessons still pending, and a course with zero required lessons receives 0%. ModuleWithLessons does not expose isRequired or required counts by module, although the server has is_required when building rows.

Correction: state the denominator in the summary, such as “4 de 9 obrigatórias”, with total lesson count secondary. For a course with no required lessons, avoid an ambiguous 0% label. Derive a module completion marker server-side only when requiredLessonCount > 0 and every required lesson is complete. Use a clear label such as “Obrigatórias concluídas” if optional lessons remain; do not imply every lesson is complete. Compute summaries from the full curriculum before any filtering and keep release/sequence locks separate. No persisted state or migration is needed.

Canvas distinguishes complete, in-progress, locked and unlocked module states, but its guide considers a module with no requirements complete; do not import that rule into the Hub. Sources: https://community.instructure.com/en/kb/articles/660912-how-do-i-use-modules-to-view-the-progress-of-students-in-a-course ; https://docs.moodle.org/502/en/Activity_completion ; https://www.w3.org/TR/wai-aria-1.2/#aria-current

## Personas

- Jordan, first-time learner: may confuse the current lesson with other available lessons because they share the same marker.
- Casey, mobile learner: the compact summary can make the percentage look like it covers every lesson, while optional lessons are excluded.
- Sam, screen-reader/keyboard user: the current link already exposes aria-current; preserve semantic status text for completion and lock. No real AT testing was performed.

## Minor observations

- A ?busca= query can filter out the current lesson; no visible search control was found, so this is conditional rather than a confirmed user-facing defect. If search is exposed, preserve the active item.
- Test navigation between lessons in different modules to confirm the accordion follows the current lesson after client navigation; static inspection alone does not prove a bug.
- Mobile summary has no progress bar; it can remain compact if it uses the same explicit denominator.

## Improve first

Keep the current sidebar anatomy. First replace the ambiguous lesson markers; then use a server-derived required-progress summary for the course and module indicators. The result should scan quickly without treating optional lessons as incomplete required work or conflating completion with access.

## Questions to consider

- Should the module signal say “Obrigatórias concluídas” whenever optional lessons remain, rather than “Módulo concluído”?
- Should the summary show the fraction of required lessons alongside the percent, with the all-lesson count secondary?
