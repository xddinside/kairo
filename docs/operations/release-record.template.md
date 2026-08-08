# Kairo Release Record

Copy this record beside the deployment. `pending` is a validation placeholder, not evidence that a gate passed. A production release is blocked until every P0 result has evidence.

```text
release_id:
commit:
environment:
schema_migration:
catalog_version:
prompt_version:
model_id:
model_endpoint_checked_at:
runtime_node_version:
dependency_scan:
typecheck:
build:
unit_and_integration_tests:
browser_and_accessibility_tests:
performance_results:
database_backup_id:
database_restore_drill:
file_backup_manifest:
file_restore_drill:
security_headers_check:
sentry_release_and_alerts:
provider_terms_and_retention_checked_at:
rollback_target:
open_p1_items:
release_owner:
approved_at:
```

`release_id` must equal the full 40-character Git commit SHA. The validation command records no provider credentials or student content.
