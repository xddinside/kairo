# Kairo

Kairo is a student productivity workspace that reshapes itself around what a student needs to do.

## Language

**User**:
A private student account that owns all Kairo records.
_Avoid_: Account, member

**Course**:
An academic subject that may group a student's tasks, assessments, notes, and files.
_Avoid_: class, workspace

**Task**:
An actionable piece of student work with an optional course, assessment, due date, and completion state.
_Avoid_: to-do, deadline

**Assessment**:
A graded or evaluative academic obligation with an optional course, due date, and completion state.
_Avoid_: exam, assignment, deadline

**Deadline**:
A combined view of dated tasks and assessments; it is not a separately owned record.
_Avoid_: due item

**Timetable entry**:
A local-time academic event that may repeat weekly within a date range and may have explicit exceptions.
_Avoid_: class schedule, calendar event

**Note**:
Markdown authored by the student and optionally linked to one Course.
_Avoid_: document

**File**:
An original Markdown or PDF uploaded by the student and optionally linked to one Course.
_Avoid_: attachment, document

**Focus session**:
A timed study session owned by a User, with at most one active session and a retained completed or cancelled history.
_Avoid_: timer, pomodoro

**Canvas activity**:
An ordered request, attachment, accepted action, or clarification answer recorded in a saved Canvas.
_Avoid_: message, chat turn

**Generated view**:
A successful, immutable goal-shaped workspace composed for a student from their stated intent and current academic context.
_Avoid_: Generated dashboard, AI screen

**Canvas**:
A saved work thread where a student gives Kairo context, acts on generated views, and returns to earlier views.
_Avoid_: Chat, conversation

**Canvas home**:
The fresh, unsaved Canvas shown when Kairo opens. Its first meaningful action creates a saved Canvas.
_Avoid_: Empty saved Canvas

**Generated view history**:
The ordered successful generated views within one Canvas. Clarifying, generating, and recovery are transition states, not history entries.
_Avoid_: Tabs, undo history

**Clarification**:
A temporary request for missing or uncertain input before Kairo generates a view or changes shared academic data.
_Avoid_: Generated view, error state

**Shared academic data**:
The courses, tasks, assessments, timetable entries, notes, files, and focus state available to every Canvas and stable product route.
_Avoid_: Canvas data

**Action**:
A named operation offered by a Generated view that reads or changes shared academic data.
_Avoid_: generated handler, arbitrary command

**Domain command**:
A server-authorized request to make one change to shared academic data.
_Avoid_: model write, batch action

**Undo**:
A request to reverse one recent reversible Domain command when current data still permits it.
_Avoid_: rollback, global undo history

**Canvas transition**:
A temporary generating, Clarification, or recovery state that is not a Generated view history entry.
_Avoid_: history item, generated view

**Component catalog**:
The approved set of student-work blocks from which Kairo composes generated views.
_Avoid_: Widget library, arbitrary UI
