# Callscope — Antigravity Handover

This package contains the complete seven-file implementation handover.

## Files
- `PRD.md` — product requirements and acceptance criteria
- `ARCHITECTURE.md` — stack, project structure, data flow and API contract
- `DESIGN.md` — approved minimal visual direction
- `RULES.md` — engineering, security and product constraints
- `TASKS.md` — ordered implementation checklist
- `PROGRESS.md` — current status and verification log
- `Agent.md` — non-negotiable Antigravity operating instructions

## How to hand over
1. Extract this folder into the root of the project repository.
2. Open that repository in Antigravity.
3. Ask Antigravity to read `Agent.md` and all referenced handover files, then begin at Phase 0 in `TASKS.md`.
4. Antigravity must report after each phase and wait for me confirmation before proceeding.
5. When it reaches a real SERV or Dolphin API-key requirement, it must stop, tell me which key is needed and why, and wait for me to configure it locally and confirm. Never paste keys into chat or commit them.

The project is intentionally specified as Vite + React + TypeScript with Vercel serverless functions. Next.js is explicitly prohibited.
