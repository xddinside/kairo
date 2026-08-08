# Kairo production v1 decisions

Status: In progress

Source discussion: [Clarify Kairo's Round 2 frontier](https://github.com/xddinside/kairo/issues/2)

## Destination

Build a production-ready Kairo v1 that individual students can use end to end with private accounts, durable user-owned data, real model-backed generated views, complete product routes, document support, responsive design, and production operations.

Kairo v1 must not depend on seeded data, fixed generated views, simulated actions, or other demo-only behavior.

## Canvas

- Use the Quiet Rail shell with persistent labelled navigation.
- A Canvas is a saved work thread containing prompts, attachments, actions, clarification answers, and an ordered generated-view history.
- Kairo opens on a fresh, unsaved Canvas. The first meaningful prompt, upload, or academic-data action saves it.
- Saved Canvases have stable addresses. Reloading one keeps the student in it.
- A new Canvas starts with empty view history while retaining access to the student's shared academic data.
- The rail shows Recent canvases and provides Canvas search directly in the rail.
- Each saved Canvas has a menu for rename, archive, and delete. There is no separate All canvases page.
- Previous and next arrows browse generated views within the current Canvas. They do not change routes or undo actions.
- New generated views append to the end of the current Canvas history without deleting later views when the student is viewing an older one.
- Only successful generated views enter history. Clarifying, generating, and recovery are transition states.
- An older generated view preserves its original composition and reasoning while reflecting current shared data.
- Canvas supports the core actions available through Tasks, Timetable, Deadlines, Notes, and Focus. The stable routes expose broader fixed views of the same data.
- Workload views default to the next seven days.
- The detailed Canvas generation, action, write-through, Undo, Clarification, history, authorization, and recovery contract is recorded in [canvas-contracts.md](canvas-contracts.md).

## Clarification

- Direct facts and instructions from the student may update shared academic data immediately, with visible feedback and Undo.
- Facts inferred from uploaded files require confirmation before they change shared academic data.
- Clarification is a temporary Canvas interaction, not a generated view, modal, page, or history entry.
- One Clarification panel docks above the Canvas composer while the last usable generated view remains visible and usable.
- While clarification is active, the composer becomes the free-text answer field. Suggested answers may act as shortcuts, but typed input always works.
- There is no dedicated dismiss or skip control. The student may answer in their own words, including asking Kairo to ignore or reject a proposed change.
- One panel supports multiple questions with previous and next arrows, a position count, and preserved answers.
- Sending an answer saves it and advances to the next unanswered question.
- After the final answer, Kairo automatically resumes the blocked generation or data change without a separate review step.

## Focus

- A generated Focus view is fully functional within Canvas.
- Canvas and the stable Focus route share the same active session state; neither forces navigation to the other.
- The Focus route will provide a persistent place for the active session and focus history.
- The Focus components and route need a later visual redesign. A clean circular timer is one candidate, but core product work comes first.

## Accounts and first use

- Use Clerk for production authentication.
- Support Google sign-in and email magic links.
- After first sign-in, show a guided paginated modal with no more than three or four visual pages explaining the main features and useful first actions.
- After onboarding, Kairo opens on a fresh Canvas by default.

## Documents

- Production v1 supports Markdown and PDF upload, storage, and native viewing.
- Markdown uses a clean in-app renderer. PDFs use an in-app PDF viewer.
- Documents can provide context to generated and Focus views.
- Keep Markdown and PDF work together rather than shipping only one document type first.
- Store original files.
- Office files, audio, video, and OCR for scanned documents are not part of the first document scope.

## Notifications

- Use in-app toasts for immediate feedback and reminders.
- Browser notifications are deferred out of v1; the v1 release ships in-app reminders only (see the notification contract and [Approve the reminder scheduler deployment tier](https://github.com/xddinside/kairo/issues/22)).
- Email and native mobile push notifications are not required for v1.

## Responsive product

- Every core workflow must be fully usable on desktop and mobile web.
- Mobile may change composition and interaction patterns rather than merely shrinking the desktop layout.
- Responsive quality is a top product and hackathon criterion.
- Offline mode and native mobile apps are not required for v1.

## User data rights

- Users can delete their account, Canvases, and uploaded files.
- Users can export their structured academic data, Markdown notes, and original files.

## Domain model

- One private User owns every Kairo record. Clerk's user id is the external identity key. There is no sharing or separate Account model in v1.
- Courses may group Tasks, Assessments, Notes, and Files. Tasks are actionable work; Assessments are graded or evaluative obligations. Either may carry a due date and optional time.
- Deadlines are a combined view over dated Tasks and Assessments, not an entity. Tasks may link to one Assessment. Tasks and Assessments do not recur in v1.
- Timetable entries use the User's local timezone, weekly recurrence, date ranges, and explicit exceptions. Focus timestamps remain instants.
- Focus allows at most one active session per User and keeps completed or cancelled history. Sessions may link to a Task, Course, and Canvas.
- Canvases own ordered activity and successful immutable Generated views. Shared academic data remains independent of a Canvas.
- Tasks and Assessments use open, completed, and cancelled states where applicable. Canvases use active or archived state. User deletion is permanent and cascades owned records and link rows.

## Stable routes

- `/` redirects to `/canvas`; `/canvas` is the fresh Canvas home and `/canvas/:canvasId` is a saved Canvas.
- `/courses` and `/courses/:courseId` cover Course list and detail operations.
- `/tasks` and `/tasks/:taskId` cover Task list and detail operations.
- `/timetable` and `/timetable/:entryId` cover Timetable entries.
- `/notes` and `/notes/:noteId` cover Notes.
- `/files` and `/files/:fileId` cover file listing, upload, native viewing, and deletion.
- `/focus` shows the active session and history; `/focus/:sessionId` deep-links to a retained session.
- Generated views have no route of their own. Canvas history arrows change state without changing the URL, and reload defaults to the latest successful view.
- Deadlines have no stable route. Canvas infers deadline pressure from dated Tasks and Assessments and explains the evidence in a Generated view.
- Collection routes list and create. Detail routes read, edit, and delete. All stable routes scope operations to the current User and return the same not-found result for unknown and foreign ids.
- Filters use typed URL search parameters with a seven-day workload default, explicit ISO dates, stable ordering, and cursor pagination for unbounded lists. Prefer Effect Schema's Standard Schema adapter; use nuqs only if that adapter cannot work with TanStack Router.
- `/canvas/today` remains prototype-only.

## Product boundary

- Build real persistence, generation, actions, recovery, deployment, security, monitoring, and backups.
- Billing, collaboration, institutional administration, and external LMS or calendar integrations remain outside production v1 unless added later.
- Do not let the former judge-demo timebox or seeded Round 1 prototype constrain the production architecture.

## Still open

- The production database, file storage, model provider, deployment, monitoring, and backup stack.
- The model context, agent loop, provider limits, and Kairo-owned renderer internals that implement the Canvas contract.
- The visual and interaction design for Focus and document-assisted focus sessions.
- Notification scheduling, permission timing, and reminder controls.
- Onboarding dismissal, replay, and completion behavior.
- Accessibility, performance, security, retention, and launch acceptance criteria.
