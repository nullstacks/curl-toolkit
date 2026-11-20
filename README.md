# cURL Toolkit

A client-side cURL converter and API testing client. All parsing, code generation, HTTP requests and storage run in the browser. There is no backend.

## Run

    npm install
    npm run dev        # local development
    npm test           # Vitest: parser, codegen, persistence, Fetch runner
    npm run build      # type-check, then static build into dist/

Deploy the contents of `dist/` to GitHub Pages, Cloudflare Pages, Vercel or Netlify. The build uses relative asset paths (`base: './'`), so it works from a subdirectory. No server, function or rewrite rule is required.

## What runs where

- `src/lib/curl/parser.ts` tokenises a shell command and maps options to an editable request. Unsupported options are returned as data with a reason, never silently dropped.
- `src/lib/codegen/` builds one language-neutral intermediate representation (`ir.ts`) and renders it per language. The cURL round trip is covered by tests.
- `src/lib/http/prepare.ts` builds the exact method, URL, headers and body that will be sent.
- `src/lib/http/runner.ts` sends the request with `fetch`, using `AbortController` for timeouts and cancellation. It classifies failures as cancelled, timeout, network or invalid. Network errors get a CORS explanation. The app does not and cannot bypass CORS.
- `src/lib/storage/` holds the Dexie (IndexedDB) schema, secret redaction, and backup import/export.

## Security notes

- Passwords, bearer tokens, API key values, cookies and secret-looking headers are masked before anything is written to IndexedDB. Enable "Exclude sensitive data" in Settings to drop them entirely.
- Masked requests are flagged so the user knows to re-enter secrets.
- Local data is not encrypted. Anyone with access to this browser profile can read it. Do not keep production credentials on a shared machine.
- Environment variables marked "secret" are stored in IndexedDB in clear text; the flag only hides the value in the UI.

## Known limits

- Browsers do not allow scripts to set `Host`, `Cookie`, `Origin`, `User-Agent`, `Content-Length` and similar headers. Those are shown and flagged, not sent.
- Only `http:` and `https:` URLs are supported.
- Client certificates, proxies, custom CA bundles, `--insecure`, DNS overrides and local file uploads cannot be reproduced in the browser.
- Responses are readable only for CORS-safelisted headers unless the server sends `Access-Control-Expose-Headers`.

## Status

See the accompanying notes for what is implemented and what is not.
