/**
 * Host half of the Interactive Steps bundle.
 *
 * Contributes two things to the profile:
 *
 * 1. The `interactive_steps` Tool. It is deliberately inert on the Host: its
 *    only job is to put a walkthrough into the conversation log so the Client
 *    half can render it as a clickable card. Clicking through the steps happens
 *    entirely in the browser and never calls back into the Host.
 * 2. A system-prompt section telling the model when to prefer that Tool, which
 *    is what makes an ordinary multi-step answer use the card instead of a
 *    plain markdown list.
 *
 * The Tool definition is written as a plain object rather than through
 * `defineTool(...)` from `@deepseek-ai/dsh-tools`: a profile-installed bundle
 * resolves only its declared dependencies, so that package is not importable
 * from here. `tools.register` only requires `output.render` plus a supported
 * JSON Schema, which the raw schemas below already are.
 *
 * @module @local/dsh-interactive-steps
 */
/** Cordis plugin name. */
export const name = 'interactive-steps'

/** The Tool registry and the prompt registry this row contributes to. */
export const inject = ['tools', 'systemPrompt']

/**
 * Deliberately no `Config` export.
 *
 * The Loader validates a row's `config` only against a native schemastery
 * schema, and `@deepseek-ai/schemastery` is not resolvable from this workspace
 * bundle (the profile's `node_modules` holds only directly declared
 * dependencies). Importing it would fail activation outright, so both knobs are
 * environment variables read at activation instead — no dependency, and still
 * adjustable per launch.
 */
const MAX_STEPS_DEFAULT = 24

/** Read a positive integer override, ignoring anything unusable. */
function readPositiveInt(raw, fallback) {
  if (typeof raw !== 'string' || raw.trim() === '') return fallback
  const parsed = Number(raw)
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/** Whether to register the guidance that pushes multi-step answers onto the card. */
function guidanceEnabled() {
  const raw = process.env.DSH_INTERACTIVE_STEPS_GUIDANCE
  return raw === undefined || raw.trim() === '' ? true : raw.trim() !== '0'
}

/** The configured ceiling on presented steps. */
function maxStepsSetting() {
  return readPositiveInt(process.env.DSH_INTERACTIVE_STEPS_MAX, MAX_STEPS_DEFAULT)
}

/**
 * Prompt-section order. The prompt registry places its own tool sections at
 * 1000–3000; 1900 sits among them as a Tool-guidance section without colliding
 * with a named order owned by a shipped package.
 */
const GUIDANCE_ORDER = 1900

/** Section name, unique within its layer. */
const GUIDANCE_SECTION = 'interactive-steps:guidance'

/**
 * The instruction that makes the card the default rendering for sequential
 * content. It states both when to use the Tool and when not to, because an
 * unqualified "always use it" would turn every short list into a card.
 */
const GUIDANCE_TEXT = [
  'When an answer is naturally a sequence the reader should work through one step at a time —',
  'a multi-step plan, procedure, setup, migration, or troubleshooting walkthrough — present it with',
  'the `interactive_steps` Tool so it renders as a clickable card in the conversation instead of a',
  'long inline list. Give each step a short `title` plus an optional `detail`, and put any exact',
  'command, numbers, or parameter values in `code` for that step.',
  '',
  'Use `interactive_steps` only for genuinely sequential content of three or more steps where each',
  'step carries its own substance. Do not use it for a flat enumeration of unrelated points, for a',
  'single conclusion, or when a sentence or two states the answer more directly. When you do use it,',
  'keep the surrounding prose brief: the card holds the detail. Honour an explicit request to answer',
  'in plain text, or not to use a card, for that reply.'
].join('\n')

/** Human-readable schema handed to the model. */
const PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: {
      type: 'string',
      description:
        'Short heading for the stepper card, for example "从文本到图片". Defaults to "Steps".'
    },
    steps: {
      type: 'array',
      description:
        'The complete ordered list of steps to present. Each step is one card page the user clicks through.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: {
            type: 'string',
            description: 'One-line step title, shown in the step rail and as the page heading.'
          },
          detail: {
            type: 'string',
            description: 'Optional supporting paragraph, shown under the page heading.'
          },
          code: {
            type: 'string',
            description: 'Optional monospace block, for a command or a short excerpt.'
          },
          note: {
            type: 'string',
            description: 'Optional caveat or gotcha, rendered as a highlighted callout.'
          }
        }
      }
    }
  }
}

/** Shape of this Tool's structured result. */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          detail: { type: 'string' },
          code: { type: 'string' },
          note: { type: 'string' }
        }
      }
    }
  },
  required: ['title', 'steps']
}

/** Trim a value to a non-empty string, or return undefined. */
function optionalText(value) {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text === '' ? undefined : text
}

/**
 * Normalize the model-supplied steps into the exact shape both the result value
 * and the Client card consume. Unknown fields are dropped; a step without a
 * usable title is discarded rather than rendered as an empty page.
 *
 * @param args - the raw Tool arguments.
 * @param maxSteps - the configured ceiling on presented steps.
 * @returns the presentation title and its steps.
 */
export function normalizeSteps(args, maxSteps = 24) {
  const input = args !== null && typeof args === 'object' ? args : {}
  const rawTitle = optionalText(input.title)
  const rawSteps = Array.isArray(input.steps) ? input.steps : []
  const limit = Number.isFinite(maxSteps) && maxSteps > 0 ? maxSteps : 24
  const steps = []
  for (const candidate of rawSteps) {
    if (steps.length >= limit) break
    if (candidate === null || typeof candidate !== 'object') continue
    const title = optionalText(candidate.title)
    if (title === undefined) continue
    steps.push({
      title,
      detail: optionalText(candidate.detail),
      code: optionalText(candidate.code),
      note: optionalText(candidate.note)
    })
  }
  return { title: rawTitle ?? 'Steps', steps }
}

/**
 * Build the Tool definition for one activation's Config.
 *
 * @param maxSteps - the configured ceiling on presented steps.
 * @returns the definition registered on this plugin's context.
 */
function interactiveStepsTool(maxSteps) {
  return {
    name: 'interactive_steps',
    description:
      'Present an ordered walkthrough as an interactive step card in the conversation flow. ' +
      'The card renders inside this Tool call: the user clicks steps to move between them, ' +
      'with no file to open and no further Tool call. Use it when a process, plan, or ' +
      'explanation is naturally a sequence of steps the user should read one at a time.',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render(args, value) {
        const displayed = Array.isArray(value.steps) ? value.steps.length : 0
        const headings = Array.isArray(value.steps)
          ? value.steps.map((step, index) => `${index + 1}. ${step.title}`)
          : []
        const lines = [
          `Presented "${value.title}" as an interactive ${displayed}-step card in the conversation flow.`,
          'The user switches steps inside the card itself.'
        ]
        if (headings.length > 0) lines.push('', ...headings)
        return [{ type: 'text', text: lines.join('\n') }]
      }
    },
    execute(args) {
      return Promise.resolve(normalizeSteps(args, maxSteps))
    },
    presentCall(args) {
      const { title, steps } = normalizeSteps(args, maxSteps)
      return {
        card: 'generic',
        title: steps.length > 0 ? `${title} · ${steps.length} 步` : title,
        kind: 'other'
      }
    }
  }
}

/**
 * Register both contributions as effects owned by this row's context, so
 * unloading the bundle or patching the row away removes them again.
 *
 * @param ctx - this row's Cordis context.
 */
export function apply(ctx) {
  const maxSteps = maxStepsSetting()
  ctx.effect(
    () => ctx.tools.register(interactiveStepsTool(maxSteps)),
    'interactive-steps: register interactive_steps'
  )
  if (guidanceEnabled()) {
    ctx.effect(
      () =>
        ctx.systemPrompt.section({
          name: GUIDANCE_SECTION,
          order: GUIDANCE_ORDER,
          text: GUIDANCE_TEXT,
          // The text is literal repository prose, so it must not be interpolated.
          interpolate: false
        }),
      'interactive-steps: register prompt guidance'
    )
  }
}
