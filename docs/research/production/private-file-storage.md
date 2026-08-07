# Private file storage for Kairo production

Research date: 7 August 2026

## Short answer

Use Cloudflare R2 through one Effect `FileStorage` adapter. R2 buckets are private by default, presigned URLs grant time-limited access, egress is free on every plan, and the free tier (10 GB-month, 1 million Class A and 10 million Class B operations per month) renews each month. It requires a billing account and charges overage. Backblaze B2 is the fallback: same S3 mechanics, 10 GB always free, but egress is only free up to 3x average monthly storage.

Vercel Blob, UploadThing, Convex File Storage, and Supabase Storage are all usable but weaker fits: UploadThing's free plan cannot keep files private, Convex and Supabase each mean adopting a second data platform, and Vercel Blob's free limits are much smaller than R2's and hard-stop access when exceeded.

## What counts as durable free

A durable free tier keeps renewing instead of ending with a trial or one-time credit. It may require a billing account, bill overage, or block overage; those terms must be stated.

- R2: free amounts renew every month, and overage is billed. Enabling R2 requires completing Cloudflare's subscription checkout and keeping a payment method on the billing account. It is not a trial.
- Backblaze B2: 10 GB storage "always free", overage billed.
- Vercel Blob Hobby: free within 1 GB storage, 10,000 simple operations, 2,000 advanced operations, and 10 GB data transfer per month. Overage is not billed; Blob becomes inaccessible when a limit is exceeded, and Vercel says the user must wait 30 days to use it again.
- UploadThing free: 2 GB storage shared across all apps, unlimited uploads and downloads, 7-day audit log. Durable but small.
- Convex free: 1 GB file storage, 1 GB/month egress, 1 million function calls/month total, all hard-capped; hitting a cap fails operations, nothing is billed.
- Supabase free: 1 GB file storage, 5 GB egress, 50 MB maximum upload size, 2 active projects, and free projects pause after one week of inactivity.

## What counts as real private access

A hard-to-guess URL is not privacy. Real privacy means an unauthenticated request gets a 401/403 or a signature error, and access is granted only through credentials the application controls, usually a short-lived signed URL.

- R2: private by default ("Bucket names and buckets are not public by default"). Presigned URLs for GET, HEAD, PUT, DELETE, valid 1 second to 7 days. Unauthorized requests return 401 and are not billed.
- B2: buckets are private unless explicitly made public. Presigned URLs for download and upload via the S3 API.
- Vercel Blob: private stores and signed URLs are available on every plan. Since June 2026, signed URLs can grant one `GET`, `HEAD`, `PUT`, or `DELETE` operation on one path for up to 7 days, so files no longer need to pass through a server function.
- UploadThing: files are public by URL on every plan unless the app ACL is set to `private`; the docs say private ACLs and regions are only available on paid plans. The free 2 GB plan cannot keep files private.
- Convex: `storage.getUrl()` returns a URL that "anyone with the URL can access the file without another app-level authorization check"; the only revocation is deleting the file.
- Supabase: private buckets with RLS policies and signed URLs, but only if you operate a Supabase project, which is the second-data-platform problem below.

## The second data platform question

Kairo's metadata, ownership, and file records stay in Neon Postgres. A storage provider must be a dumb object store, not another application backend.

- Convex is a reactive database plus backend runtime. Its file storage is a feature of that platform. Adopting it for files means adopting Convex for identity-adjacent state, auth integration, and function hosting, which is exactly the second data platform Kairo ruled out. Its bearer-URL file access would also require an app-level proxy for every download.
- Supabase Storage lives inside a Supabase project, which is a hosted Postgres instance with its own auth. Using it for files alone still means running a second database platform beside Neon, duplicating ownership and access logic in Supabase policies. The constraint says not to add Supabase as a second database for file storage, and that stands.
- R2, B2, and Vercel Blob are plain object stores. Files in, files out, no application logic. Kairo keeps all ownership and authorization in Neon and in TanStack Start server functions.

## Provider findings

### Cloudflare R2

- Free tier: 10 GB-month storage (Standard class only), 1 million Class A operations, 10 million Class B operations per month; egress is free on every plan, including beyond the free tier. Delete operations are free. Overage is billed; the free amounts renew monthly.
- Privacy: buckets are private by default; presigned URLs (1 second to 7 days) for GET, HEAD, PUT, DELETE; CORS rules are configurable per bucket for browser uploads.
- Uploads: direct browser PUT to a presigned URL; 5 GiB maximum single-part upload, up to 4.995 TiB multipart.
- Deletion: `DeleteObject` is a free operation.
- Export: any S3 client (AWS CLI, rclone) can list, copy, or download the bucket; Super Slurper and Sippy exist for migrations.
- Residency: automatic placement is the default. An optional location hint guides placement but does not guarantee it; an EU jurisdiction setting does guarantee that objects stay in the EU.
- Vercel + Node/Bun: the S3 API is plain HTTPS; the AWS SDK for JavaScript v3 runs on Node and Bun. No Vercel-specific integration needed.
- Sources: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 setup](https://developers.cloudflare.com/r2/get-started/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [create buckets](https://developers.cloudflare.com/r2/buckets/create-buckets/), [data location](https://developers.cloudflare.com/r2/reference/data-location/), [limits](https://developers.cloudflare.com/r2/platform/limits/).

### Backblaze B2

- Free tier: first 10 GB always free; egress free up to 3x average monthly storage, then $0.01/GB; Class A/B/C transactions free, Class D billed at $0.004 per 10,000 with the first 2,500/day free.
- Privacy: buckets are private unless made public; presigned URLs for download and upload via the S3-compatible API. CORS must be enabled for browser use. POST form uploads are not supported; presigned PUT works.
- Uploads: browser PUT to presigned URL (CORS enabled); maximum file size 10 GB via S3 API (not re-verified today, treat as approximate).
- Deletion and export: S3 DeleteObject and any S3 tooling.
- Vercel + Node/Bun: S3-compatible, works with the AWS SDK. Egress to Vercel is not one of the free partner CDN routes, so egress counts against the 3x allowance.
- Sources: [B2 pricing](https://www.backblaze.com/cloud-storage/pricing), [S3-compatible API](https://www.backblaze.com/docs/cloud-storage-s3-compatible-api).

### Vercel Blob

- Free tier (Hobby): 1 GB storage, 10,000 simple operations, 2,000 advanced operations, and 10 GB data transfer per month. Overage is not billed; when a limit is exceeded the store becomes inaccessible, and Vercel says the user must wait 30 days to use it again. This is the weakest point for a free production app.
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

| | Cloudflare R2 | Backblaze B2 | Vercel Blob (Hobby) | UploadThing (Free) | Convex (Free) | Supabase (Free) |
| --- | --- | --- | --- | --- | --- | --- |
| Free storage | 10 GB-month | 10 GB | 1 GB | 2 GB | 1 GB | 1 GB |
| Free egress | Unlimited (always) | Up to 3x storage/mo | 10 GB/mo | Unlimited | 1 GB/mo | 5 GB/mo |
| Free ops | 1M Class A / 10M Class B /mo | Class A-C free | 10K simple / 2K advanced | Unlimited uploads/downloads | 1M function calls (shared) | Unlimited API requests |
| Overage behavior | Billed | Billed | Blocked 30 days | Paid plan required for privacy | Hard stop | Hard stop / pause |
| Private by default | Yes | Yes | Store-level | No (public URL) | No (bearer URL) | Policy-level |
| Signed URLs | Yes (1s-7d) | Yes | Yes (up to 7d) | Paid plans only | No | Yes |
| Browser upload | PUT presigned | PUT presigned | PUT presigned | Native | Upload URL | Native / TUS |
| Deletion | Free op | Free op | Free op | SDK | Mutation | API |
| Export | S3 tools | S3 tools | Dashboard/SDK | Limited | `convex export` | API/download |
| Second data platform | No | No | No | No | Yes | Yes |
| Max file size | 5 GiB/request | Approx. 10 GB (unverified) | 5 TB | Route-configurable | Unlimited | 50 MB free / 500 GB Pro |

## Recommendation

**Use Cloudflare R2.** Reasons, in order of weight:

1. Real privacy on the free tier: private by default, presigned URLs with short expiry, and unauthorized reads return 401.
2. Durable free tier: monthly renewal, no trial, no hard stop; egress is free even past the free tier, which is the one cost that grows with real users.
3. No second data platform: it is a plain object store; Neon stays the only database.
4. Free deletion, cheap reads (10 million Class B reads/month), and standard S3 tooling for export and migration.
5. Works from Vercel on Node or Bun with the AWS SDK; no provider SDK leaks into app code if one adapter owns it.

**Fallback: Backblaze B2.** Same S3 mechanics and a genuine always-free 10 GB, but egress is capped at 3x average storage and browser uploads need CORS plus PUT presigned URLs (POST forms are unsupported). Choose it only if R2 becomes unavailable.

**Deliberately not chosen:** Vercel Blob (only 1 GB and a 30-day hard stop after crossing a free limit, though its private signed-URL support now meets Kairo's security needs), UploadThing (free plan cannot keep files private; 2 GB shared), Convex and Supabase (second data platforms with public-URL or policy-locked file models).

## Flows

Authorization for every flow begins in a TanStack Start server function. The browser never sees provider credentials.

**Upload.** The server function checks the Clerk session and the user's storage quota, then asks the `FileStorage` adapter for a presigned PUT URL for a server-chosen key (for example `users/{userId}/{fileId}`) with the content type pinned. The browser PUTs the file straight to R2. The server function then confirms the object exists (HEAD) and inserts the file record into Neon. If the record insert fails, the object is orphaned and the cleanup job below reclaims it.

**Authorized view/download.** The server function checks ownership against Neon, then asks the adapter for a presigned GET URL with a short TTL (5 to 15 minutes) and the download filename attached. The browser loads or redirects to that URL. A file whose owner no longer exists never gets a URL.

**Delete.** The server function checks ownership, deletes the Neon record, then deletes the object (free in R2). If object deletion fails, the record is gone and the object is reclaimed by cleanup; if record deletion fails, object deletion is skipped and the user sees an error.

**Export.** Two levels: per-file downloads reuse the view flow, and a full export is a server function that mints a batch of short-lived GET URLs (for example 25 at a time) or documents the rclone/S3 copy command for account-level migration. R2 objects download as ordinary files over HTTPS.

**Orphan cleanup.** A nightly scheduled server function scans Neon for file records whose object was never confirmed, and for objects older than a cutoff that no longer match any record. R2 `ListObjects` (Class A) or per-key `HeadObject` (Class B) reveals the mismatch; `DeleteObject` is free. Lifecycle rules on the bucket can also expire objects by age as a second net.

## Effect FileStorage interface duties

The interface is a contract, not code. Its duties:

- `createUploadUrl`: given owner, file kind, content type, and size bounds, return a one-time short-lived PUT URL and the key it targets.
- `createDownloadUrl`: given a key, return a short-lived GET URL with optional filename and content disposition.
- `delete`: given a key, remove the object.
- `head` or `exists`: confirm an object and its size without downloading it.
- `listKeys` (bounded): enumerate keys for cleanup and export.
- `downloadToBuffer` or `streamOut`: for server-side operations such as export or content inspection.
- The adapter owns all provider SDK imports, credential handling, key naming, content-type pinning, CORS policy, and URL expiry policy. App code and server functions depend only on the interface. One adapter per provider; swapping providers means writing one new adapter, nothing else.

The Neon schema owns identity: one file record per object, holding the key, owner id, kind, size, content type, and timestamps. The storage service never decides who may read a file; server functions decide that.

## Hackathon with real users

Not acceptable to skip privacy. Kairo's files are a student's notes and PDFs; they are private by default even before anyone asks. UploadThing's free plan would publish every file under a URL, which the provider itself only calls "hard-to-guess," and its 2 GB shared cap would fail real use anyway. The privacy requirement is exactly why R2 (or B2) beats the friendlier upload SDKs: the free tier already has the private model built in, so there is no "make it private later" migration.

## Facts not verified

- UploadThing's absolute maximum file size per upload is not stated on the pages checked (per-route limits are).
- Backblaze B2's maximum single-file size via the S3 API is given as approximately 10 GB but was not confirmed against a current page.
