# Design System

## Design objective
A focused, quiet, trustworthy utility. The visual quality target is the clarity and restraint of Linear and Apple Notes, not a visual imitation of either product.

The current approved mock-up is a direction reference, not a pixel-perfect requirement. Build a cleaner and more restrained version where the content and evidence do the work.

## Principles
- One page, one job, one primary action.
- White or near-white surfaces; restrained neutral borders.
- Strong typography and spacing instead of decorative cards.
- Use colour only to communicate state or action.
- No gradients, glass effects, ornamental waves, glowing shadows, or oversized hero sections.
- No taglines, marketing copy, explanatory paragraphs, helper text, secondary labels, or promotional claims.
- Do not add navigation for a one-page tool.
- No fake metrics, confidence percentages, or “safe” badges.

## Layout
### Initial state
A compact header with product name at left and small, unobtrusive SERV/Dolphin attribution at right.

Below it, one aligned analysis form:
- Network selector.
- Governor address input.
- Proposal ID input.
- Primary `Analyse` button.

The form should fit comfortably on desktop without dominating the page. On narrow screens, stack fields in a sensible order and make the primary action full width.

### Result state
Render below the form on the same page. Do not navigate to a separate dashboard.

Order:
1. Assessment banner.
2. Proposal details and status.
3. Executable actions.
4. Significant findings and description consistency.
5. SERV and Dolphin review summaries.
6. Evidence links.

Use simple sections separated by whitespace and subtle dividers. Avoid a card for every small piece of information. Group related information naturally.

### Loading and errors
- Button shows a clear loading state and prevents duplicate submission.
- Keep the submitted input visible.
- Show concise actionable errors.
- Distinguish invalid input, not found, unsupported Governor format, upstream outage, and incomplete analysis.
- Do not replace a detailed previous result with a blank screen while a new request is loading; handle state deliberately.

## Colour tokens
Use a small neutral palette:
- Page: `#F8F9FB`
- Surface: `#FFFFFF`
- Primary text: `#17191F`
- Secondary text: `#626875`
- Border: `#E5E7EB`
- Primary action: `#315EF5`
- Primary action hover: `#244BD0`
- Review/warning: `#A86412` with pale background `#FFF6E8`
- Incomplete/error: `#B42318` with pale background `#FFF1F0`
- Informational/neutral: `#EEF2F7`
- Positive neutral result: `#167647` with pale background `#ECFDF3`

Do not use green to imply guaranteed safety. The positive colour may only accompany the exact phrase `No significant issue detected` and its limitation statement.

## Typography
- Use the system sans-serif stack. Do not add a font download unless there is a compelling measured reason.
- Product name: compact, semibold.
- Page and section headings: clear hierarchy, not oversized.
- Body: 14–16px equivalent.
- Metadata: readable, never tiny or low contrast.
- Use tabular numerals for IDs, addresses, and amounts where supported.
- Long addresses and calldata must wrap or have deliberate truncation with a way to inspect/copy the full value.

## Components
Only create components that have a clear responsibility:
- `AnalysisForm`
- `AssessmentBanner`
- `ProposalDetails`
- `ActionList` / `ActionItem`
- `FindingsList`
- `ProviderReviews`
- `EvidenceLinks`
- `InlineStatus` only if reused.

Avoid generic design-system abstractions, excessive component splitting, custom icon libraries, animation libraries, and component kits unless the implementation proves they are needed.

## Interaction and accessibility
- Semantic HTML and native form controls where practical.
- Every input has a programmatic label; labels need not be verbose.
- Visible keyboard focus.
- Keyboard-operable selector, inputs, button, expandable action details and links.
- Colour is never the only indicator of status.
- Meet WCAG AA contrast for text and interactive controls.
- Respect reduced-motion preference; preferably avoid motion.
- Buttons have clear disabled/loading states.
- Copy controls, if implemented, must announce success accessibly.
- Ensure mobile layout works at 320px width without horizontal page scrolling.

## Content rules
Use direct labels:
- `Network`
- `Governor`
- `Proposal ID`
- `Analyse`
- `Status`
- `Actions`
- `Findings`
- `Description consistency`
- `SERV review`
- `Dolphin review`
- `Evidence`

No marketing phrases such as “Fast. Reliable. Evidence-based.” No claims like “high confidence.” No claim that an AI independently verifies safety.

## Responsive behaviour
- Desktop: compact form row; result sections may use two columns only where it improves scanning.
- Tablet/mobile: single column; action details and evidence remain readable.
- Do not hide critical findings or status on mobile.
