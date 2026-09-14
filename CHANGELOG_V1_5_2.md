# Project Controls AI Suite v1.5.2

## OpenAI and Anthropic Claude cloud AI providers

- Added **OpenAI** to the Global AI Model selector.
- Added browser-local OpenAI API-key storage with Save, Test and Clear controls.
- OpenAI requests use the official **Responses API** (`POST /v1/responses`).
- Default OpenAI model is `gpt-5.6`; the model field remains editable.
- Added **Anthropic Claude** to the Global AI Model selector.
- Added browser-local Anthropic API-key storage with Save, Test and Clear controls.
- Claude requests use the official **Messages API** (`POST /v1/messages`) with `x-api-key` and `anthropic-version`.
- Default Claude model is `claude-sonnet-5`; the model field remains editable.
- OpenAI and Claude are available to all shared toolkit AI workflows, including NotebookLM+, analytical chats and Schedule Builder generation.
- No AI remains the default. No cloud key is embedded in the repository or release package.
- Cloud keys continue to be stored only in the user's current browser profile when the user explicitly chooses Save locally.
- Cloud generation allowance was increased to support larger generated schedules.
- Cache/version identifiers bumped to `v1.5.2` for GitHub Pages deployment.
