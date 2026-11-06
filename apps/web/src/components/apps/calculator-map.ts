/**
 * Calculator registry: slug -> the Calculator.astro that renders it.
 *
 * Shared by pages/apps/[slug].astro (tools) and pages/games/[slug].astro (games).
 * The implementations live in the private gekro-apps repo (cloned into
 * ./apps-private at build time). Adding an app or game: one import + one map entry.
 */

import LLMCostCalculator from '../apps-private/llm-cost-calculator/Calculator.astro';
import MarkdownVisualizer from '../apps-private/markdown-visualizer/Calculator.astro';
import VoiceTranscriber from '../apps-private/voice-transcriber/Calculator.astro';
import AmortizationCalculator from '../apps-private/amortization-calculator/Calculator.astro';
import RegexPlayground from '../apps-private/regex-playground/Calculator.astro';
import CronBuilder from '../apps-private/cron-builder/Calculator.astro';
import PromptTokenCounter from '../apps-private/prompt-token-counter/Calculator.astro';
import TeslaTripCalculator from '../apps-private/tesla-trip-calculator/Calculator.astro';
import PositionSizer from '../apps-private/position-sizer/Calculator.astro';
import UnixTimestampConverter from '../apps-private/unix-timestamp-converter/Calculator.astro';
import DebtToIncomeCalculator from '../apps-private/debt-to-income-calculator/Calculator.astro';
import GraphingCalculator from '../apps-private/graphing-calculator/Calculator.astro';

import BmiCalculator from '../apps-private/bmi-calculator/Calculator.astro';
import CoinFlipper from '../apps-private/coin-flipper/Calculator.astro';
import CurrencyConverter from '../apps-private/currency-converter/Calculator.astro';
import GlobalClock from '../apps-private/global-clock/Calculator.astro';
import RichTextToMarkdown from '../apps-private/rich-text-to-markdown/Calculator.astro';
import DiceRoller from '../apps-private/dice-roller/Calculator.astro';

import JsonFormatter from '../apps-private/json-formatter/Calculator.astro';
import TextDiff from '../apps-private/text-diff/Calculator.astro';
import JwtDecoder from '../apps-private/jwt-decoder/Calculator.astro';
import PasswordGenerator from '../apps-private/password-generator/Calculator.astro';
import DummyDataGenerator from '../apps-private/dummy-data-generator/Calculator.astro';
import CodeSnippetPng from '../apps-private/code-snippet-png/Calculator.astro';
import ColorToolkit from '../apps-private/color-toolkit/Calculator.astro';
import GradientGenerator from '../apps-private/gradient-generator/Calculator.astro';
import ImageCompressor from '../apps-private/image-compressor/Calculator.astro';
import CsvToJson from '../apps-private/csv-to-json/Calculator.astro';
import DeviceInfo from '../apps-private/device-info/Calculator.astro';
import CssButtonGenerator from '../apps-private/css-button-generator/Calculator.astro';
import QrCodeGenerator from '../apps-private/qr-code-generator/Calculator.astro';
import Tokenizer from '../apps-private/tokenizer/Calculator.astro';
import RagChunkInspector from '../apps-private/rag-chunk-inspector/Calculator.astro';
import GpuVramCalculator from '../apps-private/gpu-vram-calculator/Calculator.astro';
import EvChargingCost from '../apps-private/ev-charging-cost/Calculator.astro';
import DockerComposeVisualizer from '../apps-private/docker-compose-visualizer/Calculator.astro';
import JsonSchemaToTool from '../apps-private/json-schema-to-tool/Calculator.astro';
import SystemPromptLinter from '../apps-private/system-prompt-linter/Calculator.astro';
import ContextWindowVisualizer from '../apps-private/context-window-visualizer/Calculator.astro';
import SystemdUnitGenerator from '../apps-private/systemd-unit-generator/Calculator.astro';
import HashGenerator from '../apps-private/hash-generator/Calculator.astro';
import Base64Encoder from '../apps-private/base64-encoder/Calculator.astro';
import SshConfigGenerator from '../apps-private/ssh-config-generator/Calculator.astro';
import NginxConfigGenerator from '../apps-private/nginx-config-generator/Calculator.astro';
import FineTuningFormatter from '../apps-private/finetuning-formatter/Calculator.astro';
import PromptDiff from '../apps-private/prompt-diff/Calculator.astro';
import ModelBenchmark from '../apps-private/model-benchmark/Calculator.astro';
import LlmResponseUnpacker from '../apps-private/llm-response-unpacker/Calculator.astro';
import OptionsPnl from '../apps-private/options-pnl/Calculator.astro';
import DrawdownCalculator from '../apps-private/drawdown-calculator/Calculator.astro';
import HyperscalerComparison from '../apps-private/hyperscaler-comparison/Calculator.astro';
import ReasoningCostCalculator from '../apps-private/reasoning-cost-calculator/Calculator.astro';
import StreamingResponsePlayer from '../apps-private/streaming-response-player/Calculator.astro';
import TokenProbabilityVisualizer from '../apps-private/token-probability-visualizer/Calculator.astro';
import PromptCacheOptimizer from '../apps-private/prompt-cache-optimizer/Calculator.astro';
import MultimodalTokenCounter from '../apps-private/multimodal-token-counter/Calculator.astro';
import LoraMemoryCalculator from '../apps-private/lora-memory-calculator/Calculator.astro';
import LlamaCppConfigBuilder from '../apps-private/llama-cpp-config-builder/Calculator.astro';
import McpServerTester from '../apps-private/mcp-server-tester/Calculator.astro';
import TeslaChargeOptimizer from '../apps-private/tesla-charge-optimizer/Calculator.astro';
import HtmlViewer from '../apps-private/html-viewer/Calculator.astro';
import WordCounter from '../apps-private/word-counter/Calculator.astro';
import WebsocketTester from '../apps-private/websocket-tester/Calculator.astro';
import LocalModelRecommender from '../apps-private/local-model-recommender/Calculator.astro';
import McpTraceVisualizer from '../apps-private/mcp-trace-visualizer/Calculator.astro';
import RagEvalToolkit from '../apps-private/rag-eval-toolkit/Calculator.astro';
import TaxLossHarvester from '../apps-private/tax-loss-harvester/Calculator.astro';
import PdfMerger from '../apps-private/pdf-merger/Calculator.astro';
import Translator from '../apps-private/translator/Calculator.astro';
import ChatTemplateBuilder from '../apps-private/chat-template-builder/Calculator.astro';
import SamplingPlayground from '../apps-private/sampling-playground/Calculator.astro';
import AgentLoopCostEstimator from '../apps-private/agent-loop-cost-estimator/Calculator.astro';
import LlmJsonRepair from '../apps-private/llm-json-repair/Calculator.astro';
import LlmApiBuilder from '../apps-private/llm-api-builder/Calculator.astro';
import EmbeddingPlayground from '../apps-private/embedding-playground/Calculator.astro';
import GgufInspector from '../apps-private/gguf-inspector/Calculator.astro';
import FinetuneDatasetAuditor from '../apps-private/finetune-dataset-auditor/Calculator.astro';
import RateLimitPlanner from '../apps-private/rate-limit-planner/Calculator.astro';
import ConfigConverter from '../apps-private/config-converter/Calculator.astro';
import MarkdownTableGenerator from '../apps-private/markdown-table-generator/Calculator.astro';
import HiddenTextInspector from '../apps-private/hidden-text-inspector/Calculator.astro';
import InferenceLatencyEstimator from '../apps-private/inference-latency-estimator/Calculator.astro';
import AiEnergyCalculator from '../apps-private/ai-energy-calculator/Calculator.astro';
import VectorDbCalculator from '../apps-private/vector-db-calculator/Calculator.astro';
import AiProvenanceInspector from '../apps-private/ai-provenance-inspector/Calculator.astro';
import PunctuationFixer from '../apps-private/punctuation-fixer/Calculator.astro';
import TextFormatter from '../apps-private/text-formatter/Calculator.astro';

// Wave 7 — regional tools (EU AI Act + India tax). Deterministic, zero-dep, no inference.
import EuAiActRiskClassifier from '../apps-private/eu-ai-act-risk-classifier/Calculator.astro';
import IndiaCtcSalaryCalculator from '../apps-private/india-ctc-salary-calculator/Calculator.astro';
import IndiaTaxRegimeComparator from '../apps-private/india-tax-regime-comparator/Calculator.astro';

// Wave 8 — Apple unified-memory buy-decision tool (M6 / M5 Pro / M5 Max / M5 Ultra).
import AppleSiliconLlmConfigurator from '../apps-private/apple-silicon-llm-configurator/Calculator.astro';

// Wave 9 - multi-domain unit converter (data/electrical/physical).
import UnitConverter from '../apps-private/unit-converter/Calculator.astro';

// Wave 10 - rotational ambigram generator (stroke-union glyph engine).
import AmbigramMaker from '../apps-private/ambigram-maker/Calculator.astro';
// Wave 8 - passport photo editor: crop + guides + print sheet, fully client-side.
import PassportPhotoMaker from '../apps-private/passport-photo-maker/Calculator.astro';
// Wave 9 - games (category fun).
import Sudoku from '../apps-private/sudoku/Calculator.astro';
import Snake from '../apps-private/snake/Calculator.astro';
import TicTacToe from '../apps-private/tic-tac-toe/Calculator.astro';
import MatchPairs from '../apps-private/match-pairs/Calculator.astro';
import MergeTiles from '../apps-private/merge-tiles/Calculator.astro';
import SlidingPuzzle from '../apps-private/sliding-puzzle/Calculator.astro';
import Mines from '../apps-private/mines/Calculator.astro';
import LightGrid from '../apps-private/light-grid/Calculator.astro';
import TowerOfHanoi from '../apps-private/tower-of-hanoi/Calculator.astro';
import Hangman from '../apps-private/hangman/Calculator.astro';
import FourInARow from '../apps-private/four-in-a-row/Calculator.astro';
import Reversi from '../apps-private/reversi/Calculator.astro';
import Solitaire from '../apps-private/solitaire/Calculator.astro';
import ReactionTime from '../apps-private/reaction-time/Calculator.astro';
import PegSolitaire from '../apps-private/peg-solitaire/Calculator.astro';
import Checkers from '../apps-private/checkers/Calculator.astro';
import DotsAndBoxes from '../apps-private/dots-and-boxes/Calculator.astro';
import Gomoku from '../apps-private/gomoku/Calculator.astro';
import CodeBreaker from '../apps-private/code-breaker/Calculator.astro';
import Nim from '../apps-private/nim/Calculator.astro';
import AimTrainer from '../apps-private/aim-trainer/Calculator.astro';
import TypingTest from '../apps-private/typing-test/Calculator.astro';
import Nonogram from '../apps-private/nonogram/Calculator.astro';
import WordGuess from '../apps-private/word-guess/Calculator.astro';
import LoopPuzzle from '../apps-private/loop-puzzle/Calculator.astro';
import IslandBridges from '../apps-private/island-bridges/Calculator.astro';
import MazeDash from '../apps-private/maze-dash/Calculator.astro';
import LetterGrid from '../apps-private/letter-grid/Calculator.astro';
import ColourFlood from '../apps-private/colour-flood/Calculator.astro';
import BinaryPuzzle from '../apps-private/binary-puzzle/Calculator.astro';
import SumGrid from '../apps-private/sum-grid/Calculator.astro';
import InequalityGrid from '../apps-private/inequality-grid/Calculator.astro';
import ColourTubes from '../apps-private/colour-tubes/Calculator.astro';
import PipeConnect from '../apps-private/pipe-connect/Calculator.astro';
import TrafficJam from '../apps-private/traffic-jam/Calculator.astro';
import CratePusher from '../apps-private/crate-pusher/Calculator.astro';
import WordSearch from '../apps-private/word-search/Calculator.astro';
import TimesTables from '../apps-private/times-tables/Calculator.astro';
import ClockReader from '../apps-private/clock-reader/Calculator.astro';
import CoinCounter from '../apps-private/coin-counter/Calculator.astro';
import ColourClash from '../apps-private/colour-clash/Calculator.astro';
import MorseTutor from '../apps-private/morse-tutor/Calculator.astro';
import Mancala from '../apps-private/mancala/Calculator.astro';
import Hex from '../apps-private/hex/Calculator.astro';
import NineMensMorris from '../apps-private/nine-mens-morris/Calculator.astro';
import FoxAndGeese from '../apps-private/fox-and-geese/Calculator.astro';
import Chess from '../apps-private/chess/Calculator.astro';
import GoFish from '../apps-private/go-fish/Calculator.astro';
import CrazyEights from '../apps-private/crazy-eights/Calculator.astro';
import CardWar from '../apps-private/card-war/Calculator.astro';
import Dominoes from '../apps-private/dominoes/Calculator.astro';
import SnakesAndLadders from '../apps-private/snakes-and-ladders/Calculator.astro';
import PigDice from '../apps-private/pig-dice/Calculator.astro';
import BrickSmasher from '../apps-private/brick-smasher/Calculator.astro';
import PatternEcho from '../apps-private/pattern-echo/Calculator.astro';
import CritterPop from '../apps-private/critter-pop/Calculator.astro';
import WingHop from '../apps-private/wing-hop/Calculator.astro';
import RoadHopper from '../apps-private/road-hopper/Calculator.astro';
import SoftLanding from '../apps-private/soft-landing/Calculator.astro';
import CannonShot from '../apps-private/cannon-shot/Calculator.astro';
import FallingSand from '../apps-private/falling-sand/Calculator.astro';
import CellGarden from '../apps-private/cell-garden/Calculator.astro';
import PixelArt from '../apps-private/pixel-art/Calculator.astro';
import DrumPad from '../apps-private/drum-pad/Calculator.astro';
import Piano from '../apps-private/piano/Calculator.astro';
import ColourMixer from '../apps-private/colour-mixer/Calculator.astro';
import CountingGarden from '../apps-private/counting-garden/Calculator.astro';
import ShapeSorter from '../apps-private/shape-sorter/Calculator.astro';
import MakeTen from '../apps-private/make-ten/Calculator.astro';
import SpellingBuilder from '../apps-private/spelling-builder/Calculator.astro';
import PatternMaker from '../apps-private/pattern-maker/Calculator.astro';
import OddOneOut from '../apps-private/odd-one-out/Calculator.astro';
import SortIt from '../apps-private/sort-it/Calculator.astro';
import DotToDot from '../apps-private/dot-to-dot/Calculator.astro';
import ColouringBook from '../apps-private/colouring-book/Calculator.astro';
import PicturePuzzle from '../apps-private/picture-puzzle/Calculator.astro';
import BalloonMaths from '../apps-private/balloon-maths/Calculator.astro';
import LetterTracer from '../apps-private/letter-tracer/Calculator.astro';
import BubblePop from '../apps-private/bubble-pop/Calculator.astro';


export const CALCULATOR_MAP: Record<string, any> = {
  'llm-cost-calculator': LLMCostCalculator,
  'markdown-visualizer': MarkdownVisualizer,
  'voice-transcriber': VoiceTranscriber,
  'amortization-calculator': AmortizationCalculator,
  'regex-playground': RegexPlayground,
  'cron-builder': CronBuilder,
  'prompt-token-counter': PromptTokenCounter,
  'tesla-trip-calculator': TeslaTripCalculator,
  'position-sizer': PositionSizer,
  'unix-timestamp-converter': UnixTimestampConverter,
  'debt-to-income-calculator': DebtToIncomeCalculator,
  'graphing-calculator': GraphingCalculator,
  'bmi-calculator': BmiCalculator,
  'coin-flipper': CoinFlipper,
  'currency-converter': CurrencyConverter,
  'global-clock': GlobalClock,
  'rich-text-to-markdown': RichTextToMarkdown,
  'dice-roller': DiceRoller,
  'json-formatter': JsonFormatter,
  'text-diff': TextDiff,
  'jwt-decoder': JwtDecoder,
  'password-generator': PasswordGenerator,
  'dummy-data-generator': DummyDataGenerator,
  'code-snippet-png': CodeSnippetPng,
  'color-toolkit': ColorToolkit,
  'gradient-generator': GradientGenerator,
  'image-compressor': ImageCompressor,
  'csv-to-json': CsvToJson,
  'device-info': DeviceInfo,
  'css-button-generator': CssButtonGenerator,
  'qr-code-generator': QrCodeGenerator,
  'tokenizer': Tokenizer,
  'rag-chunk-inspector': RagChunkInspector,
  'gpu-vram-calculator': GpuVramCalculator,
  'ev-charging-cost': EvChargingCost,
  'docker-compose-visualizer': DockerComposeVisualizer,
  'json-schema-to-tool': JsonSchemaToTool,
  'system-prompt-linter': SystemPromptLinter,
  'context-window-visualizer': ContextWindowVisualizer,
  'systemd-unit-generator': SystemdUnitGenerator,
  'hash-generator': HashGenerator,
  'base64-encoder': Base64Encoder,
  'ssh-config-generator': SshConfigGenerator,
  'nginx-config-generator': NginxConfigGenerator,
  'finetuning-formatter': FineTuningFormatter,
  'prompt-diff': PromptDiff,
  'model-benchmark': ModelBenchmark,
  'llm-response-unpacker': LlmResponseUnpacker,
  'options-pnl': OptionsPnl,
  'drawdown-calculator': DrawdownCalculator,
  'hyperscaler-comparison': HyperscalerComparison,
  'reasoning-cost-calculator': ReasoningCostCalculator,
  'streaming-response-player': StreamingResponsePlayer,
  'token-probability-visualizer': TokenProbabilityVisualizer,
  'prompt-cache-optimizer': PromptCacheOptimizer,
  'multimodal-token-counter': MultimodalTokenCounter,
  'lora-memory-calculator': LoraMemoryCalculator,
  'llama-cpp-config-builder': LlamaCppConfigBuilder,
  'mcp-server-tester': McpServerTester,
  'tesla-charge-optimizer': TeslaChargeOptimizer,
  'html-viewer': HtmlViewer,
  'word-counter': WordCounter,
  'websocket-tester': WebsocketTester,
  'local-model-recommender': LocalModelRecommender,
  'mcp-trace-visualizer': McpTraceVisualizer,
  'rag-eval-toolkit': RagEvalToolkit,
  'tax-loss-harvester': TaxLossHarvester,
  'pdf-merger': PdfMerger,
  'translator': Translator,
  'chat-template-builder': ChatTemplateBuilder,
  'sampling-playground': SamplingPlayground,
  'agent-loop-cost-estimator': AgentLoopCostEstimator,
  'llm-json-repair': LlmJsonRepair,
  'llm-api-builder': LlmApiBuilder,
  'embedding-playground': EmbeddingPlayground,
  'gguf-inspector': GgufInspector,
  'finetune-dataset-auditor': FinetuneDatasetAuditor,
  'rate-limit-planner': RateLimitPlanner,
  'config-converter': ConfigConverter,
  'markdown-table-generator': MarkdownTableGenerator,
  'hidden-text-inspector': HiddenTextInspector,
  'inference-latency-estimator': InferenceLatencyEstimator,
  'ai-energy-calculator': AiEnergyCalculator,
  'vector-db-calculator': VectorDbCalculator,
  'ai-provenance-inspector': AiProvenanceInspector,
  'punctuation-fixer': PunctuationFixer,
  'text-formatter': TextFormatter,
  'eu-ai-act-risk-classifier': EuAiActRiskClassifier,
  'india-ctc-salary-calculator': IndiaCtcSalaryCalculator,
  'india-tax-regime-comparator': IndiaTaxRegimeComparator,
  'apple-silicon-llm-configurator': AppleSiliconLlmConfigurator,
  'unit-converter': UnitConverter,
  'ambigram-maker': AmbigramMaker,
  'passport-photo-maker': PassportPhotoMaker,
  'sudoku': Sudoku,
  'snake': Snake,
  'tic-tac-toe': TicTacToe,
  'match-pairs': MatchPairs,
  'merge-tiles': MergeTiles,
  'sliding-puzzle': SlidingPuzzle,
  'mines': Mines,
  'light-grid': LightGrid,
  'tower-of-hanoi': TowerOfHanoi,
  'hangman': Hangman,
  'four-in-a-row': FourInARow,
  'reversi': Reversi,
  'solitaire': Solitaire,
  'reaction-time': ReactionTime,
  'peg-solitaire': PegSolitaire,
  'checkers': Checkers,
  'dots-and-boxes': DotsAndBoxes,
  'gomoku': Gomoku,
  'code-breaker': CodeBreaker,
  'nim': Nim,
  'aim-trainer': AimTrainer,
  'typing-test': TypingTest,
  'nonogram': Nonogram,
  'word-guess': WordGuess,
  'loop-puzzle': LoopPuzzle,
  'island-bridges': IslandBridges,
  'maze-dash': MazeDash,
  'letter-grid': LetterGrid,
  'colour-flood': ColourFlood,
  'binary-puzzle': BinaryPuzzle,
  'sum-grid': SumGrid,
  'inequality-grid': InequalityGrid,
  'colour-tubes': ColourTubes,
  'pipe-connect': PipeConnect,
  'traffic-jam': TrafficJam,
  'crate-pusher': CratePusher,
  'word-search': WordSearch,
  'times-tables': TimesTables,
  'clock-reader': ClockReader,
  'coin-counter': CoinCounter,
  'colour-clash': ColourClash,
  'morse-tutor': MorseTutor,
  'mancala': Mancala,
  'hex': Hex,
  'nine-mens-morris': NineMensMorris,
  'fox-and-geese': FoxAndGeese,
  'chess': Chess,
  'go-fish': GoFish,
  'crazy-eights': CrazyEights,
  'card-war': CardWar,
  'dominoes': Dominoes,
  'snakes-and-ladders': SnakesAndLadders,
  'pig-dice': PigDice,
  'brick-smasher': BrickSmasher,
  'pattern-echo': PatternEcho,
  'critter-pop': CritterPop,
  'wing-hop': WingHop,
  'road-hopper': RoadHopper,
  'soft-landing': SoftLanding,
  'cannon-shot': CannonShot,
  'falling-sand': FallingSand,
  'cell-garden': CellGarden,
  'pixel-art': PixelArt,
  'drum-pad': DrumPad,
  'piano': Piano,
  'colour-mixer': ColourMixer,
  'counting-garden': CountingGarden,
  'shape-sorter': ShapeSorter,
  'make-ten': MakeTen,
  'spelling-builder': SpellingBuilder,
  'pattern-maker': PatternMaker,
  'odd-one-out': OddOneOut,
  'sort-it': SortIt,
  'dot-to-dot': DotToDot,
  'colouring-book': ColouringBook,
  'picture-puzzle': PicturePuzzle,
  'balloon-maths': BalloonMaths,
  'letter-tracer': LetterTracer,
  'bubble-pop': BubblePop,
};
