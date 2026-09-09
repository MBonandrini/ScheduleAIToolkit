# AI Model Verification Notes — v1.2.0

The browser catalogue was narrowed to models with current upstream evidence rather than retaining speculative/obsolete model IDs.

Verified Transformers.js model repositories:
- `onnx-community/Qwen2.5-0.5B-Instruct`
- `onnx-community/Qwen2.5-1.5B-Instruct`
- `onnx-community/Llama-3.2-1B-Instruct-ONNX`

Verified current WebLLM prebuilt model IDs used by this toolkit:
- `Llama-3.2-1B-Instruct-q4f16_1-MLC`
- `Llama-3.2-3B-Instruct-q4f16_1-MLC`
- `Llama-3.1-8B-Instruct-q4f16_1-MLC`
- `Phi-3.5-mini-instruct-q4f16_1-MLC`

Runtime packages:
- `@huggingface/transformers@4.2.0`
- `@mlc-ai/web-llm@0.2.85`

The unsupported/uncertain Qwen3 WebLLM option from earlier experiments is intentionally not exposed as a selectable production model in this release.
