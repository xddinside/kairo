# Kairo notification and reminder contract

Status: implementation-ready decision artifact for production v1.

This document resolves [Research and specify notification and reminder behavior](https://github.com/xddinside/kairo/issues/14). It follows the vocabulary in `CONTEXT.md`, the production decisions, the academic-route contract, and the Canvas contract.

## Product boundary

- In-app toasts give immediate feedback for commands and scheduled reminders while Kairo is open.
- Optional browser notifications are delivered through the operating system. Email and native mobile push are out of scope for v1.
- Immediate command feedback is not a preference. Reminder categories can be turned off.
- No reminder wakes a device without an explicit browser-notification opt-in.
- No browser-notification failure blocks Tasks, Assessments, Timetable, Focus, Canvas, or account work.

## Event matrix

| Event | In-app behavior | Browser notification | Trigger and expiry |
| --- | --- | --- | --- |
| Domain command applied, already applied, conflict, validation error, or unavailable | Show the command result. Show `Undo` only when the result includes a live Undo token. | Never | Immediate response; no scheduled event. |
| Canvas generating, Clarification, or recovery transition | Keep the transition visible in Canvas. Use a toast only for a user-visible failure or completed recovery. | Never | Immediate transition; no scheduled event. |
| Open Task or Assessment with a due time | Show one reminder one hour before the due instant. | If the category is enabled, send the same reminder. | User-local due instant minus one hour; expire at the due instant. |
| Open Task or Assessment with a date but no time | Show one reminder at 09:00 on the preceding User-local date. | If the category is enabled, send the same reminder. | User-local due date minus one day at 09:00; expire at the end of the due date. |
| Timetable occurrence | Show one reminder 15 minutes before the local start. | If the category is enabled, send the same reminder. | Local occurrence start minus 15 minutes; expire at the occurrence start. |
| Focus session completed | Show the completion result while Kairo is open. | If the category is enabled, send one completion notice. | Session end instant; expire 30 minutes later. Cancellation has no reminder. |

The event compiler skips completed, cancelled, deleted, or out-of-range source records. It cancels pending events when a source record, timetable exception, or preference change makes them invalid. It never creates recurring Task or Assessment reminders because those records do not recur in v1.

Kairo does not send repeated overdue notices in v1. An overdue record remains visible in `/deadlines`, Canvas, and the relevant detail route. A reminder missed after its expiry is marked expired rather than replayed on every later visit.

## Time and scheduling rules

- The server uses the User's stored IANA `timeZone`. A browser-supplied timezone is only a setup hint and is never the authority.
- Store `scheduledFor`, `expiresAt`, Focus timestamps, and delivery timestamps as UTC instants. Store the source rule and timezone used to compute them for audit and re-computation.
- Date-only deadlines use the local calendar date. Timed deadlines use the local wall-clock time and the existing DST rules: reject a transition gap and resolve an ambiguous repeated hour to the earlier occurrence.
- Timetable recurrence expansion uses the User timezone and its existing date range and exception rules. Focus completion uses its persisted UTC end instant.
- If a calculated trigger is already past when a future source record is created or edited, schedule it immediately. Do not schedule an event for a source whose trigger and expiry have both passed.
- A timezone change cancels future pending events and recompiles them from the source records. Past delivery history is retained.
- Browser quiet hours default to 22:00–07:00 in the User timezone. They apply to scheduled browser notices, not command-result toasts or user-initiated Focus feedback. A quiet event moves to the next local quiet-hours end only when that instant is before `expiresAt`; otherwise it expires.
- In-app reminders are delivered only while a Kairo client is open and polling. They do not use page timers as the scheduling authority.

The production scheduler is a UTC Vercel Cron sweep at `* * * * *` on the selected Vercel Pro deployment. The sweep reads due rows from the database outbox, uses a lock and a bounded batch, and leaves remaining rows for the next invocation. Vercel may deliver a cron invocation twice and does not retry a failed invocation, so the worker must use both a concurrency lock and idempotent event keys. The contract does not promise second-level timing.

The minute schedule depends on Vercel Pro. Vercel Hobby's daily-only, hour-granularity limit cannot meet these reminder rules; do not deploy this contract on Hobby without changing the product SLA and recording a new decision.

## Persistence and boundaries

The exact Drizzle names may vary, but the production schema must provide these records behind the existing Effect and server-only boundaries.

```ts
type NotificationKind = "deadline" | "timetable" | "focus_completion"
type NotificationChannel = "in_app" | "browser"
type NotificationEventState = "pending" | "cancelled" | "expired"
type DeliveryState =
  | "pending"
  | "leased"
  | "shown"
  | "accepted"
  | "clicked"
  | "closed"
  | "retrying"
  | "failed"
  | "expired"

type NotificationEvent = {
  id: string
  userId: string
  eventKey: string
  kind: NotificationKind
  sourceType: "task" | "assessment" | "timetable_entry" | "focus_session"
  sourceId: string
  occurrenceKey: string | null
  scheduledFor: string       // UTC instant
  expiresAt: string           // UTC instant
  sourceTimeZone: string      // IANA name used for compilation
  ruleVersion: number
  state: NotificationEventState
  createdAt: string
  updatedAt: string
}

type NotificationPreferences = {
  inApp: {
    deadlines: boolean       // default true
    timetable: boolean       // default true
    focusCompletion: boolean  // default true
  }
  browser: {
    enabled: boolean         // default false
    deadlines: boolean        // default true when enabled
    timetable: boolean        // default true when enabled
    focusCompletion: boolean  // default true when enabled
    quietHours: { start: string; end: string } // default 22:00–07:00
    bodyMode: "generic" | "context" // default generic
  }
  version: number
  updatedAt: string
}
```

`eventKey` is unique per User and includes the source kind, source id, occurrence identity, rule version, and trigger instant. A due-time edit therefore cancels the old event and creates a new key. A retry or duplicate cron invocation cannot create a second event.

Store browser subscriptions separately:

- Keep an owner id, a stable hash of the endpoint, encrypted endpoint and encryption keys, `expiresAt` when supplied, `lastSeenAt`, `revokedAt`, and timestamps.
- Treat the endpoint as a secret capability URL. Do not place it in logs, analytics, client-readable records, or issue comments.
- Uniquely identify one subscription per User and endpoint hash. A User may have more than one browser or device subscription.
- Revoke a subscription on unsubscribe, account deletion, or a permanent push response. Re-register it when the browser reports a subscription change or an expired subscription.

Each event has one in-app delivery and one browser delivery per active subscription. Use a unique delivery key, for example `eventKey:in_app:user` or `eventKey:browser:subscriptionId`. A user who enables both channels may receive both; deduplication is per channel and does not silently remove a preference.

Domain writes enqueue a notification-schedule outbox row in the same transaction as the source write. A schedule compiler reads the canonical source record, computes the event, and upserts by `eventKey`. It must cancel old pending events when the source version, status, due value, recurrence exception, timezone, or relevant preference changes. The browser and in-app delivery workers never read client-supplied source text as authority.

## Delivery state and recovery

1. The scheduler leases due event or delivery rows with an owner, lease expiry, and attempt count.
2. In-app delivery is claimed by a foreground client through a typed endpoint. The client shows at most three reminder toasts per poll and groups the rest into one count toast. It acknowledges a reminder only after it has handed it to the accessible toast manager. An expired lease makes the row claimable again.
3. Browser delivery sends a small, encrypted Web Push payload to the active subscription. The service worker shows a persistent notification and reports click or close events without sending private record text back to the server.
4. Retry transient delivery failures at 1 minute, 5 minutes, 30 minutes, 2 hours, and 12 hours, stopping at `expiresAt` or after five attempts. A 404 or 410 response revokes the subscription. A 429 or 5xx response retries. Other 4xx responses fail the delivery and surface only a safe internal error code.
5. Mark a browser delivery `accepted` when the push service accepts it. This is not proof that the OS displayed it. A click or close event is separate evidence. If a worker crashes after an accepted request, a retry may occur; use the same event key as the notification `tag` and `renotify: false` to reduce visible duplicates, but do not claim exactly-once OS delivery.
6. A command or source update that cancels a pending event prevents future delivery. It cannot retract a notice already accepted by a push service.

The cron route is a server-only GET protected by Vercel's `CRON_SECRET`. It validates the user agent or secret, acquires a database or advisory lock, processes a bounded batch, records safe counts and error codes, and returns without exposing source text. It must not depend on an in-memory queue, a long-lived Node process, a browser timer, or Periodic Background Sync.

## Permission and browser boundary

The settings surface owns one explicit action such as `Enable browser notifications`.

1. On that user gesture, check secure-context, service-worker, Push API, and Notification support.
2. Call `Notification.requestPermission()` from the gesture. Treat `default` as not granted. If the result is `denied`, do not prompt again; show a short instruction to change the browser's site setting.
3. After `granted`, register the service worker and call `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`. Send the resulting subscription through an authenticated, CSRF-protected server function.
4. If the browser lacks a required API, subscription fails, or permission is unavailable, keep in-app reminders active and show the browser-notification setting as unavailable. A later explicit retry may attempt registration again.
5. Use persistent service-worker notifications on mobile. Do not use `new Notification()` as the production path because it is tied to a page and is not supported on many mobile browsers.

The service worker accepts only a versioned payload containing an event key, notification kind, safe destination path, scheduled timestamp, and generic copy. It calls `showNotification()` with the event key as `tag`, `renotify: false`, no `requireInteraction`, and no vibration by default. `notificationclick` closes the notice and opens only an allowlisted same-origin Kairo route. It never trusts an arbitrary URL from the payload.

By default, browser notices use generic copy such as `Kairo reminder` and `A deadline is coming up`. `bodyMode: "context"` is an explicit user choice and may include a short Task, Assessment, Timetable, or Focus label; it must never include Note Markdown, File content, model prompts, or provider output. The browser and push services may show notices on a lock screen, so generic copy is the safe default.

## Accessibility and user experience

- Kumo toasts remain an accessible status/live region, keep a text label for every action, and do not move focus away from the completed control.
- Reminder text must state the event and the next action without relying on color, sound, vibration, or a precise time format alone. The destination route remains usable by keyboard and touch.
- Browser-notification settings expose current state (`off`, `needs permission`, `denied`, `enabled`, `unsupported`, or `error`) and never imply that an accepted push request guarantees display.
- Quiet hours, disabled categories, and unavailable browsers fall back to the same route data. Users can always find overdue work in `/deadlines` and the related detail route.

## Privacy and operations

- Every preference, event, delivery, and subscription is User-scoped. Enforce ownership in the server service and database policy.
- Encrypt subscription secrets at rest. Rotate the encryption key through the existing secret-management process. Account deletion revokes subscriptions and removes notification records with the rest of the User's private data.
- Do not log Task or Assessment titles, Note Markdown, File names or content, Canvas prompts, Focus context, push endpoints, encryption keys, or notification bodies. Logs may contain event id, kind, source type, attempt, status, safe error code, request id, and latency.
- Metrics must distinguish scheduled, cancelled, expired, in-app shown, browser accepted, retrying, permanently failed, clicked, and closed. Record the configured rule and schema versions so a later change can be audited.
- Keep event and delivery history only as long as the production retention policy requires. At minimum, retain enough redacted history to diagnose a missed reminder and delete it with the User.

## Focused tests

- Schema tests accept canonical event keys, IANA zones, UTC instants, preference defaults, and delivery states; reject foreign User ids, malformed times, unsupported kinds, invalid routes, and client-owned scheduling fields.
- Time tests cover date-only deadlines, timed deadlines, local DST gaps and repeated hours, weekly Timetable expansion, exceptions, timezone changes, quiet hours crossing midnight, and trigger/expiry boundaries.
- Compiler tests prove that completing, cancelling, deleting, editing, or skipping a source cancels or replaces the correct pending event and never creates a duplicate.
- Worker tests cover duplicate cron invocations, concurrent leases, bounded batches, lost responses, retry delays, expiry, 404/410 revocation, 429/5xx retries, permanent 4xx failures, and a crash after provider acceptance.
- In-app tests cover visibility/focus polling, lease recovery, three-toast grouping, one-time acknowledgement, disabled categories, and accessible status announcements.
- Service-worker tests cover secure-context registration, permission states, subscription replacement, encrypted payload decoding, generic copy, notification tags, safe click routing, and unsupported browsers.
- Browser tests run on desktop and mobile widths with a test User and fake time. They verify one User's data cannot produce another User's notice, a denied permission is not repeatedly prompted, and core work remains usable when browser notifications are unavailable.

## Sources

Local product and architecture inputs:

- [`CONTEXT.md`](../../CONTEXT.md)
- [`production-v1-decisions.md`](./production-v1-decisions.md)
- [`production-academic-routes.md`](./production-academic-routes.md)
- [`canvas-contracts.md`](./canvas-contracts.md)
- [Choose Kairo production data and deployment foundation](https://github.com/xddinside/kairo/issues/8)

Primary technical sources:

- [MDN Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [MDN Notification.requestPermission](https://developer.mozilla.org/en-US/docs/Web/API/Notification/requestPermission_static)
- [MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN service-worker push event](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/push_event)
- [MDN ServiceWorkerRegistration.showNotification](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification)
- [MDN PushSubscription.expirationTime](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/expirationTime)
- [Vercel Cron usage and pricing](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Vercel Cron management, failure, locking, and idempotency](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [IETF RFC 8291: Message Encryption for Web Push](https://datatracker.ietf.org/doc/html/rfc8291)
- [IETF RFC 8292: VAPID for Web Push](https://datatracker.ietf.org/doc/html/rfc8292)
