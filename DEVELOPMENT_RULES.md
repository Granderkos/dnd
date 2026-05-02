# DEVELOPMENT_RULES.md

## Code Philosophy

Write clean code.

Always:

- Remove unused code
- Remove duplicate logic
- Avoid legacy leftovers
- Refactor when possible

Never:

- Leave dead code
- Duplicate components
- Hardcode strings
- Break mobile layout


---

# UI Rules

Mobile-first design.

Spacing rules:

Use consistent:

gap-3
gap-4
px-4
pb-24

Never:

Stack elements tightly without spacing.

Always:

Maintain visual breathing space.


---

# Scroll Rules

CRITICAL:

Scrolling must always work on:

- iPhone Safari
- iPhone Chrome
- Android Chrome

Never use:

h-full on scroll containers

Never use:

overflow inside overflow


---

# i18n Rules

All user-visible text must use:

translation keys.

Never:

Hardcode text like:

"Add Spell"

Use:

t("spellbook.addSpell")


---

# Layout Rules

Use:

grid when possible

Avoid:

overusing flex layouts
for multi-column content.


---

# Performance Rules

Keep components:

Small
Reusable
Focused

Avoid:

Huge monolithic components.


---

# Database Rules

Never:

Break schema without migration.

Always:

Validate data before saving.


---

# Range Conversion Rule

All feet values must display squares.

Formula:

Squares = Feet / 5

Example:

30 ft → 30 ft (6 squares)
