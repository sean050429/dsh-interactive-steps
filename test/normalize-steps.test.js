/**
 * Regression tests for the Host half.
 *
 * The bug these lock down: `normalizeSteps` used to emit every optional step
 * field unconditionally, so an omitted `detail`/`code`/`note` became an
 * own-property with value `undefined`. The Host gates Tool results through a
 * lossless-JSON check that rejects nested `undefined` (JSON drops the key), so
 * the Tool reported `returned invalid output: value is not lossless JSON`
 * *after* the Client had already rendered the card.
 */

import assert from 'node:assert/strict'
import test from 'node:test'

import { apply, normalizeSteps } from '../index.js'

/**
 * Mirror of the Host's `isRemoteJsonValue`: a value must cross JSON transport
 * without coercion or omission. Nested `undefined`, `NaN`, infinities,
 * non-plain objects, and cycles are rejected.
 */
function isLosslessJsonValue(value, seen = new Set()) {
  const type = typeof value
  if (type === 'string' || type === 'boolean') return true
  if (type === 'number') return Number.isFinite(value)
  if (value === null) return true
  if (type !== 'object') return false
  if (seen.has(value)) return false
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.every((item) => isLosslessJsonValue(item, seen))
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return false
    return Object.keys(value).every((key) => isLosslessJsonValue(value[key], seen))
  } finally {
    seen.delete(value)
  }
}

/** The minimal payload that used to fail: only `detail` and `code` are set. */
const PARTIAL_ARGS = {
  title: 'Fix steps',
  steps: [{ title: 'Step 1', detail: 'test', code: 'echo hello' }]
}

test('omitted optional fields are absent, not undefined', () => {
  const { steps } = normalizeSteps({ title: 'T', steps: [{ title: 'A' }] })
  assert.deepEqual(Object.keys(steps[0]), ['title'])
  assert.equal('detail' in steps[0], false)
  assert.equal('code' in steps[0], false)
  assert.equal('note' in steps[0], false)
})

test('provided optional fields are preserved', () => {
  const { steps } = normalizeSteps({
    title: 'T',
    steps: [{ title: 'A', detail: 'd', code: 'c', note: 'n' }]
  })
  assert.deepEqual(steps[0], { title: 'A', detail: 'd', code: 'c', note: 'n' })
})

test('every result is lossless JSON', () => {
  const cases = [
    {},
    { title: 'T' },
    PARTIAL_ARGS,
    { title: 'T', steps: [{ title: 'A', detail: 'd' }] },
    { title: 'T', steps: [{ title: 'A', code: 'c' }] },
    {
      title: 'T',
      steps: [
        { title: 'A', detail: 'd' },
        { title: 'B', code: 'c' },
        { title: 'C', detail: 'd', code: 'c', note: 'n' }
      ]
    }
  ]
  for (const args of cases) {
    assert.equal(isLosslessJsonValue(normalizeSteps(args)), true, JSON.stringify(args))
  }
})

test('the registered Tool executes to a lossless value', async () => {
  let definition
  const ctx = {
    effect(run) {
      run()
    },
    tools: {
      register(candidate) {
        definition = candidate
        return () => {}
      }
    },
    systemPrompt: { section: () => () => {} }
  }
  apply(ctx)
  assert.equal(definition.name, 'interactive_steps')
  const value = await definition.execute(PARTIAL_ARGS)
  assert.equal(isLosslessJsonValue(value), true)
  assert.deepEqual(value, {
    title: 'Fix steps',
    steps: [{ title: 'Step 1', detail: 'test', code: 'echo hello' }]
  })
  // The rendered text path consumes the same value and must still work.
  assert.equal(definition.output.render(PARTIAL_ARGS, value)[0].type, 'text')
})

test('a step without a usable title is dropped; unknown fields ignored', () => {
  const { steps } = normalizeSteps({
    title: 'T',
    steps: [{ detail: 'orphan' }, { title: '  ' }, { title: ' ok ', extra: 1 }]
  })
  assert.deepEqual(steps, [{ title: 'ok' }])
})

test('the title falls back to "Steps" and the ceiling is enforced', () => {
  assert.equal(normalizeSteps({}).title, 'Steps')
  assert.equal(normalizeSteps({ title: '  ' }).title, 'Steps')
  const many = { steps: Array.from({ length: 30 }, (_, i) => ({ title: `S${i}` })) }
  assert.equal(normalizeSteps(many, 5).steps.length, 5)
  assert.equal(normalizeSteps(many).steps.length, 24)
})
