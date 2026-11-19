# Investara design system

## iOS Crystal Clear

Investara is an Indonesian dashboard for researching IDX stocks and crypto. Use the existing CSS tokens in [app/globals.css](../../app/globals.css) as the source of truth for light and dark colors, contrast, glass blur, borders, shadows, and system typography. Reuse `ios-glass-*` and `crystal-*` surfaces, the header and controls in [components/ui.tsx](../../components/ui.tsx), and the existing Dynamic Island navigation. Keep the IHSG overview at the top of the home page.

## Interaction and responsive behavior

- Reuse `screen-shell` and `screen-section` for page gutters and spacing. Allow grids, input rows, and long company names to shrink. Keep wide tables inside `table-scroll`.
- Pair a visible focus indicator with named controls and meaningful navigation state. In dialogs, focus the first task control, support Escape, and return focus to the trigger on dismissal.
- Make icon buttons easy to tap and give them accessible names. Respect reduced-motion preferences for loading and decorative effects.
- Give loading, empty, and error states distinct messages. Offer a next action when a search returns no matches or fails.
- Keep ticker symbols and values legible on narrow screens. Use existing Indonesian formatters for market values and pair color with text or signs for positive and negative states.
- Check key paths on a narrow phone and desktop in light and dark mode. Verify keyboard navigation, scrolling, and long labels within the existing glass surfaces.

## Using UI UX Pro Max

Run focused queries with the [project-local skill](../../.agents/skills/ui-ux-pro-max/SKILL.md) for the specific interaction or layout under review.

```sh
python .agents/skills/ui-ux-pro-max/scripts/search.py "keyboard focus modal" --domain ux
python .agents/skills/ui-ux-pro-max/scripts/search.py "responsive text overflow table" --stack html-tailwind
```

Use this file as the master baseline for page-specific design decisions. Add a document under `pages/` when a page needs an intentional exception.

## Wondelai design reviews

- Use [UX Heuristics](../../.agents/skills/ux-heuristics/SKILL.md) to review a workflow and prioritize usability issues by severity.
- Use [Microinteractions](../../.agents/skills/microinteractions/SKILL.md) for control feedback, loading, empty results, and recovery.
- Use [iOS HIG Design](../../.agents/skills/ios-hig-design/SKILL.md) for touch targets and accessible behavior. Translate applicable guidance into web controls using the Crystal Clear styles.
- Use [Refactoring UI](../../.agents/skills/refactoring-ui/SKILL.md) for hierarchy and spacing within the existing palette, type scale, and glass surfaces.
