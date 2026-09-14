# v1.5.2 Validation Report

## Scope
This release adds OpenAI and Anthropic Claude as first-class bring-your-own-key cloud AI engines without changing the default No-AI behaviour.

## Provider contracts
- OpenAI: `https://api.openai.com/v1/responses`, Bearer API-key authentication, editable default model `gpt-5.6`.
- Anthropic: `https://api.anthropic.com/v1/messages`, `x-api-key`, `anthropic-version: 2023-06-01`, editable default model `claude-sonnet-5`.
- Both providers use the same shared project-controls grounding/context path as Ollama, browser models, Gemini and Grok.
- Save/Test/Clear controls persist keys only in browser `localStorage`; keys are not present in release source.

## Regression coverage
- Added a dedicated v1.5.2 provider regression test covering catalogue entries, Settings controls, local key storage, request endpoints, authentication headers, request bodies, response parsing, clear-key behaviour and shared runtime routing.
- Existing v1.2 through v1.5.1 contracts remain in the suite.

## Security note
Direct browser API-key use is intentionally supported because this toolkit is a personal bring-your-own-key static GitHub Pages workflow. It is less secure than server-side secret storage and should not be treated as a production multi-user secret-management architecture.

## Final execution results
- Normal regression suite: **27/27 PASS**.
- Exhaustive stress/volume/boundary suite: **PASS**.
- Parser fuzz: 3,000 cases.
- Large parse: 50,000 activities / 200,000 relationships.
- Large schedule health analysis: PASS.
- Comparison volume: 10,000 activities.
- Deep network chain: PASS.
- Monte Carlo/boundary run: 5,000 cases.
- No real OpenAI or Anthropic credentials were used during automated tests; request contracts and response parsing were exercised using mocked provider responses.
