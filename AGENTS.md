<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Investara UI and UX

Read [the Investara design system](design-system/investara/MASTER.md) before changing the interface. Use the project-local [UI UX Pro Max skill](.agents/skills/ui-ux-pro-max/SKILL.md) for focused usability, accessibility, and responsive checks. Preserve the iOS Crystal Clear visual language unless the user requests a new direction.

## Product planning and code reviews

Use [Jobs to Be Done](.agents/skills/jobs-to-be-done/SKILL.md) when defining the research task a feature should help users complete. Use [High Performance Browser Networking](.agents/skills/high-perf-browser/SKILL.md) when diagnosing slow loading or data requests, and [Refactoring Patterns](.agents/skills/refactoring-patterns/SKILL.md) for behavior-preserving code improvements.

The project-local Wondelai skills come from [upstream revision c526558](https://github.com/wondelai/skills/tree/c5265583b1a9740f06831e1d3e89b35bba3eb430) under the [MIT license](.agents/skills/WONDELAI-LICENSE).
