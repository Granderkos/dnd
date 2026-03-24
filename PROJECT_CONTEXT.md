# PROJECT_CONTEXT.md

## Project Name
DnD Digital Character Manager

## Project Goal

This project is a digital replacement for the physical Dungeons & Dragons 5e character sheet.

The goal is to create a mobile-friendly, multiplayer-ready digital character system that supports:

- Players
- Dungeon Masters
- Shared campaign data
- Character persistence
- Spell management
- Notes
- Inventory
- Future spell database (wiki)
- Bestiary and creature system

This project prioritizes:

- Mobile-first UI
- Fast loading
- Clean layout
- Scroll stability on iOS
- Modular architecture
- Clean code (no legacy buildup)


---

# Core Tech Stack

Frontend:
- Next.js (App Router)
- React
- TailwindCSS
- shadcn/ui components

Backend:
- Supabase
  - Auth
  - PostgreSQL database
  - Realtime capabilities

State:
- React state
- Supabase persistence


---

# Core UI Philosophy

Mobile-first always.

Important:

- No nested scroll bugs
- Hidden scrollbars
- Clean spacing
- Centered layout
- Consistent margins
- Safe-area compatible (iOS)

Never use:

- nested scroll containers
- fixed height layouts that block scrolling
- viewport hacks like unsafe 100vh usage


---

# Current Feature Set

## Character Tab

Contains:

- Character name
- Class
- Race
- Background
- Level
- Alignment

Stats:

- Strength
- Dexterity
- Constitution
- Intelligence
- Wisdom
- Charisma

Includes:

- Saving throws
- Skills
- Initiative (can be negative)
- Proficiencies
- Languages

Structure:

Abilities & Traits are split into:

- Race Features
- Class Features
- Background Features


---

## Spellbook

Spell management system.

Supports:

- Spell slots
- Spell levels
- Ritual flag
- Concentration flag
- Casting time
- Range
- Components
- Duration

Important rule:

If range contains feet:

Convert automatically:

5 feet = 1 square

Example:

60 ft → 60 ft (12 squares)


---

## Notes

Multi-note system.

Supports:

- Long text
- Full scrolling
- Mobile-safe editing

Important:

Notes must always be scrollable.

Never block scroll with fixed container height.


---

## Inventory

Supports:

- Items
- Currency
- Equipment

Currency:

- cp
- sp
- ep
- gp
- pp


---

## Language System

Supports:

- English
- Czech

All text must use i18n system.

Never hardcode UI strings.


---

# Performance Rules

Mobile load time must be minimal.

Avoid:

- large blocking renders
- unnecessary re-renders
- unused imports
- legacy components


---

# Known UI Risks

Important for developers:

iOS scrolling is fragile.

Avoid:

- nested overflow containers
- multiple scroll wrappers
- fixed vh layouts

Use:

- natural content flow
- outer scroll container


---

# Future Expansion Targets

Major upcoming systems:

- Spell Wiki
- Bestiary
- Creature Manager
- Familiar / Pet System
- Mount System
- Campaign Monster Visibility
