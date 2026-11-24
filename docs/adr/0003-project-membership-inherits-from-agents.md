# Project membership inherits from Agents

Status: superseded by ADR 0013 (2026-11-24): there is no Group membership.

A Project directly owns Agents and independently configured Uptime Monitors; data discovered or reported by an Agent inherits that Agent's Project. This avoids duplicate membership records and contradictory grouping for one workload across uptime, logs, API, metrics, and infrastructure while keeping existing installations unassigned after migration.
