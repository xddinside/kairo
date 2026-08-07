# Private file storage for Kairo production

Research date: 7 August 2026

## Short answer

Use Filebase through one Effect `FileStorage` adapter. Its free tier has 5 GB pooled storage, 5 GB/month S3 bandwidth, 1 million Class A and 10 million Class B operations, one private bucket, and no credit card. When free storage or bandwidth is exceeded, Filebase switches the free account to read-only instead of billing overage. Vercel Blob is the fallback when its Vercel-native integration matters more than the extra capacity.

Cloudflare R2 and Backblaze B2 remain good paid-capacity options, but both require a billing account and can bill overage. UploadThing's free plan cannot keep files private, Convex and Supabase each mean adopting a second data platform, and Vercel Blob's free limits are smaller than Filebase's.

## What counts as durable free

A durable free tier keeps renewing instead of ending with a trial or one-time credit. It may require a billing account, bill overage, or block overage; those terms must be stated.

- R2: free amounts renew every month, and overage is billed. Enabling R2 requires completing Cloudflare's subscription checkout and keeping a payment method on the billing account. It is not a trial.
- Backblaze B2: 10 GB storage "always free", overage billed.
- Filebase: 5 GB storage, 5 GB/month S3 bandwidth, 1 million Class A operations, 10 million Class B operations, and one bucket. No credit card is required. Storage or bandwidth over the free allowance makes the account read-only; Filebase does not bill free-tier overage.
- Vercel Blob Hobby: free within 1 GB storage, 10,000 simple operations, 2,000 advanced operations, and 10 GB data transfer per month. Overage is not billed; Blob becomes inaccessible when a limit is exceeded, and Vercel says the user must wait 30 days to use it again.
- UploadThing free: 2 GB storage shared across all apps, unlimited uploads and downloads, 7-day audit log. Durable but small.
- Convex free: 1 GB file storage, 1 GB/month egress, 1 million function calls/month total, all hard-capped; hitting a cap fails operations, nothing is billed.
- Supabase free: 1 GB file storage, 5 GB egress, 50 MB maximum upload size, 2 active projects, and free projects pause after one week of inactivity.

## What counts as real private access

A hard-to-guess URL is not privacy. Real privacy means an unauthenticated request gets a 401/403 or a signature error, and access is granted only through credentials the application controls, usually a short-lived signed URL.

- R2: private by default ("Bucket names and buckets are not public by default"). Presigned URLs for GET, HEAD, PUT, DELETE, valid 1 second to 7 days. Unauthorized requests return 401 and are not billed.
- B2: buckets are private unless explicitly made public. Presigned URLs for download and upload via the S3 API.
- Filebase: free accounts can create private buckets, and private is the default. Presigned URLs grant one operation on one object for a chosen expiry; free accounts do not get public bucket URLs.
- Vercel Blob: private stores and signed URLs are available on every plan. Since June 2026, signed URLs can grant one `GET`, `HEAD`, `PUT`, or `DELETE` operation on one path for up to 7 days, so files no longer need to pass through a server function.
- UploadThing: files are public by URL on every plan unless the app ACL is set to `private`; the docs say private ACLs and regions are only available on paid plans. The free 2 GB plan cannot keep files private.
- Convex: `storage.getUrl()` returns a URL that "anyone with the URL can access the file without another app-level authorization check"; the only revocation is deleting the file.
- Supabase: private buckets with RLS policies and signed URLs, but only if you operate a Supabase project, which is the second-data-platform problem below.

## The second data platform question

Kairo's metadata, ownership, and file records stay in Neon Postgres. A storage provider must be a dumb object store, not another application backend.

- Convex is a reactive database plus backend runtime. Its file storage is a feature of that platform. Adopting it for files means adopting Convex for identity-adjacent state, auth integration, and function hosting, which is exactly the second data platform Kairo ruled out. Its bearer-URL file access would also require an app-level proxy for every download.
- Supabase Storage lives inside a Supabase project, which is a hosted Postgres instance with its own auth. Using it for files alone still means running a second database platform beside Neon, duplicating ownership and access logic in Supabase policies. The constraint says not to add Supabase as a second database for file storage, and that stands.
- R2, B2, Filebase, and Vercel Blob are plain object stores. Files in, files out, no application logic. Kairo keeps all ownership and authorization in Neon and in TanStack Start server functions.

## Provider findings

### Filebase

- Free tier: 5 GB pooled storage, 5 GB/month S3-compatible bandwidth, 1 million Class A operations, 10 million Class B operations, one bucket, and one access-key pair. No credit card is required. Free-tier storage and bandwidth limits are hard caps; exceeding either makes writes or reads return `403` until the next month or an explicit upgrade. Failed and unauthorized requests are not charged.
- Privacy: private buckets are supported on free accounts and are the default. Presigned `GET`, `PUT`, `HEAD`, and `DELETE` URLs work for temporary access. Public bucket access is paid-only.
- Uploads: S3-compatible direct browser uploads, CORS, multipart uploads, 5 GB single PUT, 5 TB multipart total, and signed `Content-Length` constraints.
- Deletion and export: S3 `DeleteObject`, `DeleteObjects`, `ListObjectsV2`, and standard AWS CLI/rclone tooling. Deletes are free operations.
- Regions and runtime: one global S3 endpoint (`https://s3.filebase.io`, region `auto`), so there is no India-specific bucket region choice. The AWS SDK for JavaScript and ordinary S3 clients work from Vercel Node and Bun.
- Durability and recovery: Filebase encrypts objects at rest and in transit, but custom versioning rules are not available; use immutable keys and keep Neon as the recovery and ownership record. The free tier is intended for evaluation and small projects, so revisit availability and support before a larger launch.
- Sources: [Filebase free tier](https://filebase.com/free/), [Filebase pricing and hard caps](https://filebase.com/docs/account/pricing), [private buckets](https://filebase.com/docs/concepts/public-vs-private-buckets), [presigned URLs](https://filebase.com/docs/s3-api/presigned-urls), [service limits](https://filebase.com/docs/account/service-limits), [S3 API](https://filebase.com/docs/s3-api/overview).

### Cloudflare R2

- Free tier: 10 GB-month storage (Standard class only), 1 million Class A operations, 10 million Class B operations per month; egress is free on every plan, including beyond the free tier. Delete operations are free. Overage is billed; the free amounts renew monthly.
- Privacy: buckets are private by default; presigned URLs (1 second to 7 days) for GET, HEAD, PUT, DELETE; CORS rules are configurable per bucket for browser uploads.
- Uploads: direct browser PUT to a presigned URL; 5 GiB maximum single-part upload, up to 4.995 TiB multipart.
- Upload constraint: R2 documents signing `Content-Type`, but not a maximum byte size, and a presigned URL can be reused until it expires. Kairo must use a unique key and very short TTL, check the browser-declared size before signing, verify the real size with `HEAD`, and delete an oversized or repeated upload before it becomes readable. If server-enforced pre-upload byte limits become mandatory, add a narrow upload gateway or reconsider Vercel Blob, whose signed PUT tokens support a maximum-size constraint.
- Deletion: `DeleteObject` is a free operation.
- Export: any S3 client (AWS CLI, rclone) can list, copy, or download the bucket; Super Slurper and Sippy exist for migrations.
- Residency: automatic placement is the default. Kairo can request the Asia-Pacific location hint for India latency, but a hint does not guarantee India residency. R2 offers a guaranteed EU jurisdiction, not an India jurisdiction.
- Durability and recovery: R2 is designed for eleven-nines annual durability and uses strong consistency, but its S3 compatibility table marks bucket versioning and object locking as unimplemented. Hardware durability does not undo an accidental or malicious delete.
- Vercel + Node/Bun: the S3 API is plain HTTPS; the AWS SDK for JavaScript v3 runs on Node and Bun. No Vercel-specific integration needed.
- Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [create buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/), [data location](https://developers.cloudflare.com/r2/reference/data-location/), [limits](https://developers.cloudflare.com/r2/platform/limits/), [durability](https://developers.cloudflare.com/r2/reference/durability/), [S3 compatibility](https://developers.cloudflare.com/r2/api/s3/api/).

### Backblaze B2

- Free tier: first 10 GB always free; egress free up to 3x average monthly storage, then $0.01/GB; Class A/B/C transactions free, Class D billed at $0.004 per 10,000 with the first 2,500/day free.
- Privacy: buckets are private unless made public; presigned URLs for download and upload via the S3-compatible API. CORS must be enabled for browser use. POST form uploads are not supported; presigned PUT works.
- Uploads: browser PUT to presigned URL (CORS enabled); maximum file size 10 GB via S3 API (not re-verified today, treat as approximate).
- Deletion and export: S3 DeleteObject and any S3 tooling.
- Vercel + Node/Bun: S3-compatible, works with the AWS SDK. Egress to Vercel is not one of the free partner CDN routes, so egress counts against the 3x allowance.
- Sources: [B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [S3-compatible API](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api).

### Vercel Blob

- Free tier (Hobby): 1 GB storage, 10,000 simple operations, 2,000 advanced operations, and 10 GB data transfer per month. Overage is not billed; when a limit is exceeded the store becomes inaccessible, and Vercel says the user must wait 30 days to use it again. This is smaller than Filebase's free allowance.
- Privacy: private stores and signed URLs are generally available on all plans. A URL can grant one `GET`, `HEAD`, `PUT`, or `DELETE` operation on one path for up to 7 days. A server proxy remains an option when every byte must pass through Kairo, but it is no longer required for private delivery.
- Uploads: direct browser `PUT` through a signed URL supports multipart uploads. The absolute file limit is 5 TB; Vercel recommends multipart uploads above 100 MB.
- Deletion: `del()` is free.
- Export: dashboard download or the SDK `list()` plus `download()`, which costs operations and transfer.
- Vercel + Bun/Node: first-party SDK, tight Vercel integration.
- Sources: [Vercel Blob usage and pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing), [private Blob GA and signed URLs](https://vercel.com/changelog/vercel-private-blob-is-now-generally-available), [signed URL release](https://vercel.com/changelog/signed-urls-are-now-available-for-vercel-blob), [client uploads](https://vercel.com/docs/vercel-blob/client-upload).

### UploadThing

- Free tier: 2 GB storage shared across all apps, unlimited uploads and downloads, 7-day audit log retention.
- Privacy: files are public by their URL on the free plan. Private ACLs and signed URLs exist but are paid-plan features ($10/month plan). The docs state plainly that the hard-to-guess URL "is fine for many applications" but "some applications require a more secure way"; Kairo's files are that second kind.
- Uploads: browser-direct, framework adapters including TanStack Start, per-route max file size config (defaults: 4 MB image/pdf, 8 MB blob, 16 MB video, 64 kB text).
- Deletion: via UTApi; export is not a first-class flow.
- Vercel + Bun/Node: works; callbacks require the app to be reachable by UploadThing's servers.
- Sources: [UploadThing pricing](https://uploadthing.com/pricing), [regions and ACL](https://docs.uploadthing.com/concepts/regions-acl), [file routes](https://docs.uploadthing.com/file-routes).

### Convex File Storage

- Free tier: 1 GB file storage, 1 GB/month egress, and the free plan's 1 million function calls/month cap, which file accesses also count against. Caps are hard; operations fail when exceeded.
- Privacy: file URLs are public bearer URLs with no expiry; revocation means deleting the file. Serving through an HTTP action is possible but responses are capped at 20 MB.
- Uploads: direct upload URLs, no file size limit, 2-minute POST timeout.
- Second platform: yes. Convex is a database and backend, not a storage service.
- Sources: [file storage](https://docs.convex.dev/file-storage), [uploading files](https://docs.convex.dev/file-storage/upload-files), [limits](https://docs.convex.dev/production/state/limits).

### Supabase Storage

- Free tier: 1 GB file storage, 5 GB egress, 50 MB max upload size, and free projects pause after a week of inactivity. The paused-project rule alone makes it a poor home for production user files.
- Privacy: private buckets with RLS policies and signed URLs work, but the whole thing lives on a second Postgres platform beside Neon.
- Uploads: browser uploads and TUS resumable uploads; S3-compatible API.
- Sources: [Supabase pricing](https://supabase.com/pricing), [storage access control](https://supabase.com/docs/guides/storage/access-control), [storage quickstart](https://supabase.com/docs/guides/storage/quickstart), [private downloads and signed URLs](https://supabase.com/docs/guides/storage/serving/downloads).

## Comparison table

| | Filebase | Cloudflare R2 | Backblaze B2 | Vercel Blob (Hobby) | UploadThing (Free) | Convex (Free) | Supabase (Free) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Free storage | 5 GB | 10 GB-month | 10 GB | 1 GB | 2 GB | 1 GB | 1 GB |
| Free egress | 5 GB/mo | Unlimited (always) | Up to 3x storage/mo | 10 GB/mo | Unlimited | 1 GB/mo | 5 GB/mo |
| Free ops | 1M Class A / 10M Class B /mo | 1M Class A / 10M Class B /mo | Class A-C free | 10K simple / 2K advanced | Unlimited uploads/downloads | 1M function calls (shared) | Unlimited API requests |
| Overage behavior | Read-only, no bill | Billed | Billed | Blocked 30 days | Paid plan required for privacy | Hard stop | Hard stop / pause |
| Private by default | Yes | Yes | Yes | Store-level | No (public URL) | No (bearer URL) | Policy-level |
| Signed URLs | Yes | Yes (1s-7d) | Yes | Yes (up to 7d) | Paid plans only | No | Yes |
| Browser upload | PUT presigned | PUT presigned | PUT presigned | PUT presigned | Native | Upload URL | Native / TUS |
| Deletion | Free op | Free op | Free op | Free op | SDK | Mutation | API |
| Export | S3 tools | S3 tools | S3 tools | Dashboard/SDK | Limited | `convex export` | API/download |
| Second data platform | No | No | No | No | No | Yes | Yes |
| Max file size | 5 GB PUT / 5 TB multipart | 5 GiB/request | Approx. 10 GB (unverified) | 5 TB | Route-configurable | Unlimited | 50 MB free / 500 GB Pro |

## Recommendation

**Use Filebase for the hackathon.** Reasons, in order of weight:

1. Real privacy on the free tier: private by default, short-lived presigned URLs, and public buckets unavailable on free accounts.
2. No billing setup and no surprise overage: the account becomes read-only when storage or bandwidth exceeds the free cap.
3. 5 GB is five times Vercel Blob Hobby's storage allowance and enough for a small Markdown/PDF hackathon launch.
4. No second data platform: it is a plain S3-compatible object store; Neon stays the only database.
5. Free deletion, 1 million Class A and 10 million Class B operations, and standard S3 tooling for export and migration.
6. Works from Vercel on Node or Bun with the AWS SDK; no provider SDK leaks into app code if one adapter owns it.

**Fallback: Vercel Blob.** It has a smaller 1 GB cap and blocks access for 30 days after Hobby limits are crossed, but its private signed URLs and Vercel integration are first-party. Choose it if Filebase's global endpoint or free-tier availability is not acceptable.

**Paid-capacity options:** R2 remains the best option after we accept billing and want free egress beyond the cap. Backblaze B2 remains a portable S3 fallback with 10 GB storage but metered overage. UploadThing (free plan cannot keep files private), Convex, and Supabase remain rejected for Kairo's current constraints.

## Cost controls and the paid point

Filebase has the hard cap we want. Free storage is 5 GB, S3 bandwidth is 5 GB/month, Class A is 1 million/month, and Class B is 10 million/month. Storage or bandwidth overage makes the free account read-only, and Filebase does not bill it. Kairo should still track usage and show the user when uploads or downloads are nearing the cap. See [Filebase pricing](https://filebase.com/docs/account/pricing).

Before launch, Kairo must still set per-user byte, file-count, and upload-size quotas in Neon and reject an upload before minting its URL when it would cross a quota. Record daily account usage and alert well before 5 GB storage or bandwidth. The provider cap is the backstop; the app quota gives users a useful error before the account becomes read-only.

If the app outgrows 5 GB or 5 GB/month of reads, choose a paid plan or a planned migration. We should not attach billing automatically.

## Flows

Authorization for every flow begins in a TanStack Start server function. The browser never sees provider credentials.

**Upload.** The server function checks the Clerk session, browser-declared size, and the user's storage quota, creates a pending Neon record, then asks the `FileStorage` adapter for a short-lived presigned PUT URL for a server-chosen unique key (for example `users/{userId}/{fileId}`) with content type and size constraints. The browser PUTs the file straight to Filebase. The completion function confirms the object with `HEAD`, rejects and deletes it if the real size or type is wrong, then marks the record ready. If completion fails, the object stays unreadable and cleanup reclaims it.

**Authorized view/download.** The server function checks ownership against Neon, then asks the adapter for a presigned GET URL with a short TTL (5 to 15 minutes) and the download filename attached. The browser loads or redirects to that URL. A file whose owner no longer exists never gets a URL.

**Delete.** The server function checks ownership, deletes the Neon record, then deletes the object (free in Filebase). If object deletion fails, the record is gone and the object is reclaimed by cleanup; if record deletion fails, object deletion is skipped and the user sees an error.

**Export.** Two levels: per-file downloads reuse the view flow, and a full export is a server function that mints a batch of short-lived GET URLs (for example 25 at a time) or documents the rclone/S3 copy command for account-level migration. Filebase objects download as ordinary files over HTTPS.

**Orphan cleanup.** A nightly scheduled server function scans Neon for file records whose object was never confirmed, and for objects older than a cutoff that no longer match any record. Filebase `ListObjects` (Class A) or per-key `HeadObject` (Class B) reveals the mismatch; `DeleteObject` is free. Abort incomplete multipart uploads as well, since unfinished parts count toward storage.

## Security, failure, and recovery rules

- Mint upload URLs only after a Clerk check and quota check. The server chooses the key and pins the allowed method, content type, size range, and short expiry. Filebase supports signed content-length constraints; still verify the stored size after upload and use a unique immutable key. Never accept a user-supplied bucket key.
- Keep a Neon file row in `pending` state before upload. After upload, verify the object with `HEAD`, compare size and stored checksum when available, then mark it `ready`. A timed-out or failed upload stays unreadable and cleanup removes it.
- Allow only the document types Kairo supports. Check extension, declared type, and file signature; do not trust browser MIME data. Store new files as quarantined until a scan or safe parser accepts them. Do not render Markdown as raw HTML, and serve downloads with `X-Content-Type-Options: nosniff` and a safe `Content-Disposition`.
- Make commands idempotent. A repeated completion, deletion, or cleanup request must reach the same state without creating a new object or exposing one user's file to another.
- Use immutable object keys. Filebase does not provide custom versioning rules, so overwriting a key destroys the old value and deletion cannot be undone through the free storage layer. An edit creates a new key and updates the Neon reference only after verification.
- A user-requested delete must remove the live object and all Kairo metadata; do not keep a hidden recovery copy. For operator-error recovery, use a separate, documented backup policy and bucket or provider only after the user retention policy is set. Filebase's encryption and storage durability do not protect against intentional deletion.
- Give runtime credentials access only to the one private bucket. Keep account-wide credentials out of the app, rotate keys, log storage commands without logging signed URLs, and make signed GET URLs short-lived bearer secrets.

## Effect FileStorage interface duties

The interface is a contract, not code. Its duties:

- `createUploadUrl`: given owner, file kind, content type, and declared size bounds, return a short-lived PUT URL and the unique key it targets; the adapter should use Filebase's signed size constraint and still require post-upload checks.
- `createDownloadUrl`: given a key, return a short-lived GET URL with optional filename and content disposition.
- `delete`: given a key, remove the object.
- `head` or `exists`: confirm an object and its size without downloading it.
- `listKeys` (bounded): enumerate keys for cleanup and export.
- `downloadToBuffer` or `streamOut`: for server-side operations such as export or content inspection.
- The adapter owns all provider SDK imports, credential handling, key naming, content-type pinning, CORS policy, and URL expiry policy. App code and server functions depend only on the interface. One adapter per provider; swapping providers means writing one new adapter, nothing else.

The Neon schema owns identity: one file record per object, holding the key, owner id, kind, size, content type, and timestamps. The storage service never decides who may read a file; server functions decide that.

## Hackathon with real users

Not acceptable to skip privacy. Kairo's files are a student's notes and PDFs; they are private by default even before anyone asks. UploadThing's free plan would publish every file under a URL, which the provider itself only calls "hard-to-guess." Filebase gives us private storage and a hard no-bill ceiling, so the hackathon does not need a public-file compromise.

## Facts not verified

- Backblaze B2's maximum single-file size via the S3 API is given as approximately 10 GB but was not confirmed against a current page.
