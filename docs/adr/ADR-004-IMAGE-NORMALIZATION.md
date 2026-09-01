# ADR-004: S3-compatible private evidence storage and Sharp normalization

**Status:** Accepted (Phase 5)

Evidence objects are stored in a private S3-compatible bucket. The runtime receives bucket, region, endpoint, and credentials only through environment injection. Development uses MinIO from `docker-compose.yml`; production must block public access, disable ACL-based public grants, encrypt at rest and in transit, and grant the application identity only object read/write/delete access within the evidence bucket. Migration credentials and storage credentials are separate.

Clients receive five-minute, single-key `PUT` capabilities constrained by the declared content type, exact content length, and optional SHA-256 checksum. Read capabilities expire after one minute. Signed URLs and object keys are never written to logs or player DTOs.

Sharp performs bounded decoding (20 megapixels), rejects multi-page and non-JPEG/PNG/WebP inputs, verifies detected type against the declaration, applies orientation, and re-encodes to WebP. Re-encoding removes EXIF and other source metadata. The worker deletes rejected media and transactionally reopens its assignment.

PostgreSQL-backed jobs provide bounded retry and a visible `dead` state. Orphans are deleted after their upload capability expires plus the configured grace period. Terminal evidence is deleted within 24 hours, with a post-delete existence check before metadata is marked deleted.
