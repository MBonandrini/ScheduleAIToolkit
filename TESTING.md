# Technical test summary

This build was hardened and smoke-tested on 24 August 2026.

## OmniRoute

- Base URL normalization (`/v1`, `/models`, `/chat/completions`)
- Keyless local compatibility header
- Optional endpoint-key authentication
- `/v1/models` diagnostic
- Real `/v1/chat/completions` diagnostic
- `auto` route and `felo/auto` fallback
- Authentication error classification
- CORS/local-browser diagnostic
- Localhost / 127.0.0.1 loopback retry
- Separate connection and completion timeouts

## Reliability and performance

- JavaScript syntax validation across every module
- Local HTML asset-reference validation
- Duplicate HTML ID scan
- CSS brace/parsing sanity scan
- Local AI heavyweight libraries removed from eager application startup
- Schedule Assessment advanced reports changed to on-demand calculation
- Monte Carlo remains worker-based
- Shared repository IndexedDB connections now close after each operation
- Shared repository filename rendering is HTML-escaped
- Large browser-held files warn before storage

## PDF

- Professional report header, metadata panel, typography and table treatment
- Chart canvases converted to images before PDF serialization
- Repeating page header and footer
- Page number and generation date
- `Schedule AI Toolkit` footer at bottom right
- Representative report PDF rendered and visually inspected

## Deployment note

Browser-to-local OmniRoute still requires the deployed website origin to be permitted by OmniRoute CORS settings. That server-side requirement cannot be removed by frontend code.
