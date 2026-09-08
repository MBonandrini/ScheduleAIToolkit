# Project Controls AI Suite / Schedule AI Toolkit

A static, GitHub Pages-compatible project-controls workbench for Primavera P6 XER and Microsoft Project XML analysis.

## GitHub Pages

This rebuild is intentionally static. There is no server build step and no API key should be embedded in the site.

### Recommended deployment

1. Create or use your GitHub repository.
2. Copy the **contents** of this package into the repository root.
3. Push to the `main` branch.
4. In **Repository Settings → Pages**, select **GitHub Actions** as the Pages source.
5. The included `pages.yml` workflow runs the exhaustive test suite before deployment.
6. A deployment only proceeds when the test job passes.

The included `.nojekyll` file prevents Jekyll processing.

## Ollama

Default local endpoint:

`http://localhost:11434`

Use **Settings → Ollama → Check Ollama**.

If Ollama is not detected, the toolkit explains the three likely cases:
- Ollama is not installed;
- Ollama is installed but not running;
- the hosted GitHub Pages origin is not permitted to reach the local service.

For a GitHub Pages deployment, configure Ollama to permit the exact Pages origin with `OLLAMA_ORIGINS`, then restart Ollama.

## AI architecture

There is one global AI selector in the suite header.

AI configuration belongs in **Settings** only. Mini-tools do not maintain independent model selectors or conflicting model status indicators.

Checked Project Repository files are shared context across the toolkit. Parsed schedules are additionally exposed to the AI through structured schedule-query tools so large XER files do not need to be placed wholesale into every prompt.

## Tests

Normal:

```bash
npm test
```

Exhaustive:

```bash
npm run test:exhaustive
```

The exhaustive suite includes parser fuzzing, large XER volume tests, deep network tests, Monte Carlo determinism, Ollama compatibility/failure handling, repository isolation, AI context integration, GitHub Pages dependency checks, security contracts, and the master feature-completeness contract.
