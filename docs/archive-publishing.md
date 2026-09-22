# Archive publishing

Sign in with the approved owner account, open `/archive`, and select **New entry**. Add a title, plain-text post, one tag, and an optional cover. Blank lines create paragraphs. **Preview** does not publish. **Publish entry** immediately makes the entry public and updates the feed and Recent Entries. Open a published entry and select **Edit entry** to change it.

The supported tags are Announcement, Research, and Build Log. Search uses PostgreSQL English full-text search across titles and complete post bodies. Results are paginated in batches of 20. The original static Entry No. 01 remains at its existing URL; new entries have permanent `/archive/entry?id=…` links.

## Data and permissions

- `public.archive_editors` is an administrator-managed allowlist. Users can read only their own membership and cannot grant themselves publishing rights.
- `public.archive_entries` is publicly readable; insert/update require allowlist membership through RLS. Client grants exclude author, timestamps, and entry numbers. Only published posts are stored; there is no drafts table.
- Covers use the public `archive-covers` bucket, limited to JPEG, PNG, and WebP up to 5 MB. Upload/delete permissions require an allowlisted user and their own path prefix. Uploaded covers are public. SVG uploads are rejected.
- A failed save leaves the editor open with the text intact. Retrying a new post uses the same UUID, including a read-back check after uncertain responses. Edits check `updated_at` to avoid overwriting a concurrent change.
- Entry bodies are rendered as text, not HTML. The browser uses the existing publishable key and session; no privileged key is shipped.
- The additive migration was applied to the existing project. The app repository and its tables were not changed. Deploy the website to expose these controls publicly; subsequent entries require no rebuild.

## Verification

`tests/archive-permissions.sql` checks owner publishing, public reading, search, denied non-editor writes, denied self-promotion, and denied non-editor cover uploads inside a rolled-back transaction. Identity sequence values can advance even after a rollback.

`tests/archive-publishing.cjs` uses Playwright with intercepted API responses. It checks editor visibility, preview escaping, image validation, upload, failed saves, lost responses, recent entries, tag filtering, search, reader pages, and editing at desktop/mobile sizes. No live posts or uploads are created by the browser test.

Run with an installed Playwright module and Chrome:

```sh
npm run build
PLAYWRIGHT_MODULE=/absolute/path/to/playwright CHROME_PATH=/absolute/path/to/chrome node tests/archive-publishing.cjs
```

The archive-specific RLS tests passed against the live database. The public read path was also verified without a session. The project advisor's anonymous-access heuristics flag authenticated policies; archive writes additionally require membership in the protected allowlist. Existing credit/auth advisories belong to the shared app and were not changed by this feature. See [Supabase's advisor guidance](https://supabase.com/docs/guides/database/database-advisors).
