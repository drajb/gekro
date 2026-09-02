/**
 * app-icons.ts — slug to Lucide icon name.
 *
 * One icon per app, chosen for what the tool *does* rather than what its
 * subject matter is, so the /apps grid reads as a toolbox rather than a
 * sticker sheet. Deliberately reuses a shape only when two apps genuinely do
 * the same kind of work (the three config generators all use file-cog).
 *
 * Names must exist in lucide-static; tests/app-icons.test.ts asserts that
 * every app has a mapping and every mapping resolves to a real icon file.
 */
export const ICON_FOR_SLUG: Record<string, string> = {
  // ── AI ────────────────────────────────────────────────────────────────────
  'agent-loop-cost-estimator': 'repeat',
  'ai-energy-calculator': 'leaf',
  'ai-provenance-inspector': 'fingerprint',
  'apple-silicon-llm-configurator': 'cpu',
  'chat-template-builder': 'message-square-code',
  'context-window-visualizer': 'panels-top-left',
  'embedding-playground': 'git-compare-arrows',
  'eu-ai-act-risk-classifier': 'scale',
  'finetune-dataset-auditor': 'clipboard-check',
  'finetuning-formatter': 'file-json-2',
  'gguf-inspector': 'package-search',
  'gpu-vram-calculator': 'memory-stick',
  'hidden-text-inspector': 'eye-off',
  'hyperscaler-comparison': 'cloud',
  'inference-latency-estimator': 'timer',
  'json-schema-to-tool': 'wrench',
  'llama-cpp-config-builder': 'sliders-horizontal',
  'llm-api-builder': 'plug-zap',
  'llm-cost-calculator': 'circle-dollar-sign',
  'llm-json-repair': 'bandage',
  'llm-response-unpacker': 'package-open',
  'local-model-recommender': 'library',
  'lora-memory-calculator': 'layers',
  'mcp-server-tester': 'satellite-dish',
  'mcp-trace-visualizer': 'git-fork',
  'model-benchmark': 'chart-no-axes-column',
  'multimodal-token-counter': 'image-play',
  'prompt-cache-optimizer': 'database-zap',
  'prompt-diff': 'file-diff',
  'prompt-token-counter': 'hash',
  'rag-chunk-inspector': 'scissors',
  'rag-eval-toolkit': 'target',
  'rate-limit-planner': 'gauge',
  'reasoning-cost-calculator': 'brain',
  'sampling-playground': 'dices',
  'streaming-response-player': 'play',
  'system-prompt-linter': 'spell-check',
  'token-probability-visualizer': 'chart-spline',
  'tokenizer': 'type',
  'translator': 'languages',
  'vector-db-calculator': 'database',
  'voice-transcriber': 'mic',

  // ── Dev ───────────────────────────────────────────────────────────────────
  'base64-encoder': 'binary',
  'code-snippet-png': 'code-xml',
  'color-toolkit': 'palette',
  'config-converter': 'arrow-left-right',
  'cron-builder': 'calendar-clock',
  'css-button-generator': 'square-mouse-pointer',
  'csv-to-json': 'table-2',
  'dummy-data-generator': 'shuffle',
  'gradient-generator': 'blend',
  'graphing-calculator': 'function-square',
  'hash-generator': 'shield-check',
  'html-viewer': 'app-window',
  'image-compressor': 'image-minus',
  'json-formatter': 'braces',
  'jwt-decoder': 'key-round',
  'markdown-table-generator': 'table',
  'markdown-visualizer': 'file-text',
  'password-generator': 'lock',
  'pdf-merger': 'file-stack',
  'punctuation-fixer': 'pilcrow',
  'qr-code-generator': 'qr-code',
  'regex-playground': 'regex',
  'rich-text-to-markdown': 'clipboard-paste',
  'text-diff': 'columns-2',
  'text-formatter': 'case-sensitive',
  'unit-converter': 'ruler',
  'unix-timestamp-converter': 'clock',
  'websocket-tester': 'radio',
  'word-counter': 'text-select',

  // ── EV ────────────────────────────────────────────────────────────────────
  'ev-charging-cost': 'battery-charging',
  'tesla-charge-optimizer': 'plug',
  'tesla-trip-calculator': 'route',

  // ── Finance ───────────────────────────────────────────────────────────────
  'amortization-calculator': 'house',
  'currency-converter': 'arrow-right-left',
  'debt-to-income-calculator': 'scale',
  'india-ctc-salary-calculator': 'wallet',
  'india-tax-regime-comparator': 'git-compare',
  'tax-loss-harvester': 'receipt',

  // ── Fun ───────────────────────────────────────────────────────────────────
  'coin-flipper': 'circle-dot',
  'dice-roller': 'dice-5',
  'global-clock': 'globe',

  // ── Health ────────────────────────────────────────────────────────────────
  'bmi-calculator': 'heart-pulse',

  // ── Infra ─────────────────────────────────────────────────────────────────
  'device-info': 'monitor-smartphone',
  'docker-compose-visualizer': 'container',
  'nginx-config-generator': 'server-cog',
  'ssh-config-generator': 'terminal',
  'systemd-unit-generator': 'server',

  // ── Trading ───────────────────────────────────────────────────────────────
  'drawdown-calculator': 'trending-down',
  'options-pnl': 'candlestick-chart',
  'position-sizer': 'ruler',
};
