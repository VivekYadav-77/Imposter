# ADR-004: Private local evidence storage and Sharp normalization

**Status:** Accepted (Phase 5)

Evidence objects are stored in a private directory on the application server, configured with `EVIDENCE_LOCAL_DIRECTORY`. The directory must not be served as a public static path. The application issues short-lived, HMAC-protected upload and read capabilities through its own authenticated HTTP endpoints.

Clients receive five-minute, single-key `PUT` capabilities constrained by the declared content type and exact content length. Read capabilities expire after one minute. Capability URLs and object keys are never written to logs or player DTOs.

Uploads are streamed through a bounded FIFO admission gate into exclusive temporary files. Completed files are published with an atomic rename; interrupted, oversized, mismatched, or aborted streams are removed. A successful capability can be replayed idempotently, but it cannot overwrite its completed object. Stale upload claims are recoverable after the HTTP and queue timeout window. This keeps memory use bounded independently of the number and size of accepted uploads while limiting concurrent disk writes.

Sharp performs bounded decoding (20 megapixels), rejects multi-page and non-JPEG/PNG/WebP inputs, verifies detected type against the declaration, applies orientation, and re-encodes to WebP. Re-encoding removes EXIF and other source metadata. The worker deletes rejected media and transactionally reopens its assignment.

PostgreSQL-backed jobs provide bounded retry and a visible `dead` state. A configurable, small worker pool drains jobs immediately while using `SKIP LOCKED` to prevent duplicate claims. Orphans and upload temporary files are deleted after their upload capability expires plus the configured grace period. Terminal evidence is deleted within 24 hours, with a post-delete existence check before metadata is marked deleted. Server backups and recovery procedures must cover both PostgreSQL and the evidence directory when evidence recovery is required.
