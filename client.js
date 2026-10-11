/**
 * Client half of the Interactive Steps bundle.
 *
 * Registers the `tool.call.toolview` view for this bundle's own
 * `interactive_steps` Tool, keyed by the wire Tool name. The card renders
 * inside that Tool's call row in the conversation flow, so the stepper is part
 * of the chat transcript: the user clicks it there and never opens a file.
 *
 * Styling uses only `--dsw-alias-*` theme tokens, so the card follows light and
 * dark themes. Step state is component-local React state; nothing is sent back
 * to the Host when a step is clicked.
 */
window.__ModuleLoader__.load({
  id: '@local/dsh-interactive-steps',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Wire Tool name; must match the Host definition's `name`. */
    const TOOL_NAME = 'interactive_steps'

    /** Read the dispatched arguments from the call head of any Tool block. */
    function readArgs(block) {
      if (block === null || typeof block !== 'object') return {}
      const call = 'kind' in block ? block.call : block
      const raw = call !== null && typeof call === 'object' ? call.argsRaw : undefined
      if (typeof raw !== 'string' || raw === '') return {}
      try {
        const parsed = JSON.parse(raw)
        return parsed !== null && typeof parsed === 'object' ? parsed : {}
      } catch {
        return {}
      }
    }

    /** Trim to a non-empty string, else undefined. */
    function text(value) {
      if (typeof value !== 'string') return undefined
      const trimmed = value.trim()
      return trimmed === '' ? undefined : trimmed
    }

    /** Normalize the presented walkthrough, mirroring the Host half. */
    function readSteps(args) {
      const rawTitle = text(args.title)
      const rawSteps = Array.isArray(args.steps) ? args.steps : []
      const steps = []
      for (const candidate of rawSteps) {
        if (candidate === null || typeof candidate !== 'object') continue
        const title = text(candidate.title)
        if (title === undefined) continue
        steps.push({
          title,
          detail: text(candidate.detail),
          code: text(candidate.code),
          note: text(candidate.note)
        })
      }
      return { title: rawTitle, steps }
    }

    /** One-line note explaining what the reader is looking at. */
    function subtitle(count) {
      return count === 1
        ? '1 step · click it to read'
        : `${count} steps · click any step, or use ← →`
    }

    const S = {
      card: {
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        margin: '4px 0',
        padding: '14px 16px',
        border: '1px solid var(--dsw-alias-border-l1)',
        borderRadius: '12px',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-primary)',
        font: '400 14px/1.6 inherit'
      },
      header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' },
      kicker: {
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        color: 'var(--dsw-alias-label-secondary)'
      },
      status: { fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
      lead: { margin: 0, fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
      track: {
        height: '4px',
        borderRadius: '2px',
        background: 'var(--dsw-alias-bg-layer-2)',
        overflow: 'hidden'
      },
      fill: {
        display: 'block',
        height: '100%',
        background: 'var(--dsw-alias-brand-primary)',
        transition: 'width .24s cubic-bezier(.4,0,.2,1)'
      },
      body: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' },
      rail: { flex: '1 1 200px', minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '6px' },
      railIdle: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '7px 9px',
        borderRadius: '9px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit'
      },
      railDone: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '7px 9px',
        borderRadius: '9px',
        border: '1px solid var(--dsw-alias-state-success-primary)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit'
      },
      railActive: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        padding: '7px 9px',
        borderRadius: '9px',
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-bg-layer-2)',
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit'
      },
      badgeIdle: {
        flex: '0 0 20px',
        height: '20px',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: '11px',
        fontWeight: 700,
        border: '1px solid var(--dsw-alias-border-l2)',
        color: 'var(--dsw-alias-label-secondary)'
      },
      badgeOn: {
        flex: '0 0 20px',
        height: '20px',
        borderRadius: '50%',
        display: 'grid',
        placeItems: 'center',
        fontSize: '11px',
        fontWeight: 700,
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'var(--dsw-alias-brand-primary)',
        color: 'var(--dsw-alias-bg-layer-1)'
      },
      railLabel: { fontSize: '13px', fontWeight: 600, lineHeight: '1.35' },
      page: { flex: '1 1 260px', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '8px' },
      meta: { margin: 0, fontSize: '11px', color: 'var(--dsw-alias-label-secondary)' },
      heading: { margin: 0, fontSize: '16px', fontWeight: 700, lineHeight: '1.3' },
      detail: { margin: 0, fontSize: '13px', color: 'var(--dsw-alias-label-primary)' },
      code: {
        margin: 0,
        padding: '9px 11px',
        borderRadius: '9px',
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'var(--dsw-alias-bg-layer-2)',
        font: '400 12px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      },
      note: {
        margin: 0,
        padding: '8px 10px',
        borderRadius: '9px',
        border: '1px solid var(--dsw-alias-state-warn-primary)',
        fontSize: '12px'
      },
      footer: { display: 'flex', alignItems: 'center', gap: '8px' },
      nav: {
        font: 'inherit',
        fontSize: '12px',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: '999px',
        cursor: 'pointer',
        border: '1px solid var(--dsw-alias-brand-primary)',
        background: 'transparent',
        color: 'var(--dsw-alias-brand-primary)'
      },
      navOff: {
        font: 'inherit',
        fontSize: '12px',
        fontWeight: 600,
        padding: '5px 12px',
        borderRadius: '999px',
        cursor: 'not-allowed',
        opacity: 0.4,
        border: '1px solid var(--dsw-alias-border-l1)',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)'
      },
      count: { marginLeft: 'auto', fontSize: '12px', color: 'var(--dsw-alias-label-secondary)' },
      plainList: { margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' },
      plainItem: { fontSize: '13px', lineHeight: '1.6' },
      empty: { fontSize: '13px', color: 'var(--dsw-alias-label-secondary)' }
    }

    /** The clickable stepper rendered in place of the generic Tool row. */
    function InteractiveStepsCard(props) {
      const items = readSteps(readArgs(props.block)).steps
      const total = items.length
      const [index, setIndex] = React.useState(0)

      // A card can settle after more arguments arrive; keep the cursor in range.
      React.useEffect(() => {
        setIndex((current) => (current < total ? current : Math.max(0, total - 1)))
      }, [total])

      // ← / → move between steps. Captured and stopped so the shortcut never
      // reaches the application while this card is on screen.
      React.useEffect(() => {
        function onKeyDown(event) {
          if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
          event.preventDefault()
          event.stopPropagation()
          setIndex((current) => {
            const next = event.key === 'ArrowLeft' ? current - 1 : current + 1
            return next < 0 || next >= total ? current : next
          })
        }
        document.addEventListener('keydown', onKeyDown, true)
        return () => document.removeEventListener('keydown', onKeyDown, true)
      }, [total])

      if (total === 0) {
        return h(
          'div',
          { style: S.empty },
          'interactive_steps was called without a usable step list.'
        )
      }

      const current = items[Math.min(index, total - 1)]

      const rail = items.map((step, position) => {
        const state = position === index ? 'active' : position < index ? 'done' : 'todo'
        return h(
          'button',
          {
            key: position,
            type: 'button',
            'data-state': state,
            'aria-current': position === index ? 'step' : undefined,
            style: state === 'active' ? S.railActive : state === 'done' ? S.railDone : S.railIdle,
            onClick: () => setIndex(position)
          },
          h('span', { style: state === 'todo' ? S.badgeIdle : S.badgeOn }, String(position + 1)),
          h('span', { style: S.railLabel }, step.title)
        )
      })

      const body = [
        h('p', { key: 'meta', style: S.meta }, `Step ${index + 1} / ${total}`),
        h('h4', { key: 'head', style: S.heading }, current.title)
      ]
      if (current.detail !== undefined) body.push(h('p', { key: 'detail', style: S.detail }, current.detail))
      if (current.code !== undefined) body.push(h('pre', { key: 'code', style: S.code }, current.code))
      if (current.note !== undefined) body.push(h('p', { key: 'note', style: S.note }, current.note))

      let status = undefined
      if (props.phase === 'preparing') status = 'Preparing…'
      else if (props.phase === 'start') status = 'Running…'
      else if (props.phase === 'result') status = props.block.isError ? 'Failed' : 'Ready'

      return h(
        'div',
        { style: S.card, 'data-interactive-steps': 'true' },
        h(
          'div',
          { style: S.header },
          h('span', { style: S.kicker }, 'Interactive steps'),
          status !== undefined && h('span', { style: S.status }, status)
        ),
        h('p', { style: S.lead }, subtitle(total)),
        h(
          'div',
          { style: S.track, role: 'progressbar', 'aria-valuemin': 1, 'aria-valuemax': total, 'aria-valuenow': index + 1 },
          h('i', { style: Object.assign({}, S.fill, { width: `${((index + 1) / total) * 100}%` }) })
        ),
        h('div', { style: S.body }, h('div', { style: S.rail }, rail), h('div', { style: S.page }, body)),
        h(
          'div',
          { style: S.footer },
          h(
            'button',
            {
              type: 'button',
              style: index === 0 ? S.navOff : S.nav,
              disabled: index === 0,
              onClick: () => setIndex(index - 1)
            },
            '← 上一步'
          ),
          h(
            'button',
            {
              type: 'button',
              style: index === total - 1 ? S.navOff : S.nav,
              disabled: index === total - 1,
              onClick: () => setIndex(index + 1)
            },
            '下一步 →'
          ),
          h('span', { style: S.count }, `${index + 1} / ${total}`)
        )
      )
    }

    /**
     * Plan-B card: the same content as plain text, with no hooks and no
     * document listeners. It renders whenever the real card cannot, so a
     * failure is still readable instead of collapsing to a blank row.
     */
    function PlainStepsCard(props) {
      const { title, steps } = readSteps(readArgs(props.block))
      return h(
        'div',
        { style: S.card, 'data-interactive-steps': 'plain' },
        h('div', { style: S.header }, h('span', { style: S.kicker }, 'Interactive steps (plain)')),
        title !== undefined && h('p', { style: S.lead }, title),
        steps.length === 0
          ? h('p', { style: S.empty }, 'No usable step list was supplied.')
          : h(
              'ol',
              { style: S.plainList },
              steps.map((step, index) =>
                h(
                  'li',
                  { key: index, style: S.plainItem },
                  h('strong', null, step.title),
                  step.detail !== undefined && h('div', null, step.detail),
                  step.code !== undefined && h('pre', { style: S.code }, step.code),
                  step.note !== undefined && h('div', { style: S.note }, step.note)
                )
              )
            )
      )
    }

    /**
     * Error boundary around the real card. The slot owner renders a blank or
     * generic row when an entry throws, which hides the failure from the user,
     * so any render error degrades to `PlainStepsCard` instead.
     */
    class StepsBoundary extends React.Component {
      constructor(props) {
        super(props)
        this.state = { failed: false }
      }

      static getDerivedStateFromError() {
        return { failed: true }
      }

      componentDidCatch(error) {
        // Keep the reason visible in the console rather than swallowing it.
        console.error('interactive_steps card failed; falling back to plain card', error)
      }

      render() {
        return this.state.failed ? h(PlainStepsCard, this.props) : h(InteractiveStepsCard, this.props)
      }
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('tool.call.toolview', () =>
          ctx.slots.register(
            {
              name: 'tool.call.toolview',
              key: TOOL_NAME
            },
            StepsBoundary
          )
        )
      }
    }
  }
})
