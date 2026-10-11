# @local/dsh-interactive-steps

An interactive step card that renders **inside the conversation flow**.

The bundle registers one Tool, `interactive_steps`, and one Client view for that
Tool's call card. When the Tool is called, its card is not a generic row: it is a
clickable stepper. The user switches steps inside the transcript — no file to
open, no extra Tool call.

## How it works

| Half | File | Contribution |
|---|---|---|
| Host | `index.js` | Registers the `interactive_steps` Tool via `ctx.tools.register`, and a system-prompt section that tells the model when to use it. Both are owned by `ctx.effect`, so unloading removes them. |
| Client | `client.js` | Registers `tool.call.toolview` under the `interactive_steps` key, so that Tool's row renders the stepper. |

The Tool is inert on the Host: its only job is to place the walkthrough into the
conversation log. The steps travel in the Tool's **arguments**, which the Client
reads from the call head of the Tool block, so the card renders identically
during the call and after it settles, and replayed sessions render the same card.

Clicking is component-local React state; nothing is sent back to the Host.

## Automatic invocation

A registered Tool is only *available*; nothing makes the model reach for it, and
the default tendency is a markdown list. The Host half therefore also registers a
prompt section (`interactive-steps:guidance`, order 1900, among the shipped tool
sections) that says to use the card for genuinely sequential content of three or
more steps, and explicitly *not* to for flat enumerations, single conclusions, or
when the user asked for plain text.

Because this is a global profile contribution, it applies to every session in the
profile. Turn it off per launch with:

```
DSH_INTERACTIVE_STEPS_GUIDANCE=0      # tool stays registered, guidance removed
DSH_INTERACTIVE_STEPS_MAX=12          # cap steps per card (default 24)
```

There is deliberately no `Config` export: the Loader validates a row's `config`
only against a native schemastery schema, and `@deepseek-ai/schemastery` is not
resolvable from this workspace bundle, so importing it would break activation.

**Host changes need an app restart** to take effect; `client.js` changes are
picked up on reload.

## Visibility

The card renders inside the Tool-call row, and Chat folds eligible completed
Turns' process rows into a collapsed group by default. Set
**Settings → General → 工作步骤展示** to **完全展开** (Verbose) to see process rows
directly; under 简洁 / 标准 / 详细 the card is still there, but folded.

## Tool shape

```
interactive_steps({ title?, steps: [{ title, detail?, code?, note? }] })
```

- `title` — card heading; defaults to `Steps`.
- `steps[].title` — required; a step without one is dropped.
- `detail` / `code` / `note` — optional paragraph, monospace block, and callout.
- At most 24 steps are presented.

## Styling

Only `--dsw-alias-*` theme tokens are referenced (`brand-primary`, `label-*`,
`bg-layer-*`, `border-l*`, `state-success-primary`, `state-warn-primary`), so the
card follows light and dark themes and never hard-codes a palette.

## Verification

Behaviour verified without a browser by executing the real exported component
against a hook-faithful React stub: mount, rail clicks, next/previous, both
boundaries, the settled card, malformed/empty arguments, and keydown-listener
disposal. Live registration is confirmed through `cordis_inspect_query`.
