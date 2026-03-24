---
trigger: always_on
---

# Gekro Lab — Workspace Governance

As an agentic AI coding assistant, you MUST follow these governance rules to ensure consistency and prevent development regressions.

## 1. Pre-Flight Research

**BEFORE** performing any research, planning, or execution, you MUST:

- Read `.gekro/logs/issue-tracker.md` to identify known pitfalls.
- Read `.gekro/logs/decision-log.md` to understand established architectural constraints.

## 2. Issue Logging & RCA

For every bug found, user complaint, or reported issue:

- Identify the **Root Cause Analysis (RCA)**.
- Log it in `.gekro/logs/issue-tracker.md`.
- Ensure the fix explicitly addresses the RCA to prevent regressions.

## 3. Decision Safeguards

Every technical choice is a **Decision**.

- Log new decisions in `.gekro/logs/decision-log.md` with rationale and timestamp.
- **CROSS-REFERENCE**: If a user request contradicts an existing decision:
  - STOP immediately.
  - State the date/time of the conflicting decision.
  - Reason through the trade-offs.
  - Do NOT proceed until the user explicitly says **"Override"**.

## 4. Proactive Verification

If a proposed change might break an existing decision or cause a known issue from the log:

- Alert the user BEFORE implementation.
- Ask for clarification or confirmation of the potential risk.

**Maintenance**: Keep these logs updated in REAL-TIME with every prompt and implementation.
