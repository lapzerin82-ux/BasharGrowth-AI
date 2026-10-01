# Bashar AI — وكيل بشار الذكي

Modular agent configuration implementing **Section 12 — Recommended Agent
Configuration**. Instead of one undifferentiated instruction set, a central
agent orchestrates specialist modules, each with its own instructions and
quality standard.

```
                    BASHAR AI — CENTRAL AGENT
        Intent recognition • Planning • Memory • Orchestration
                               │
   ┌──────────┬──────────┬─────┴────┬──────────┬──────────┬──────────┬──────────┐
 Medical   Research   Teaching   Personal    Admin    Technology  Web Res.  Document
 clinical  research & lectures & tasks &   university apps &      evidence & files &
 support   statistics assessment scheduling workflow  development verification presentations
   └──────────┴──────────┴─────┬────┴──────────┴──────────┴──────────┴──────────┘
                               │
                        UNIFIED OUTPUT
          Verified results • Reports • Actions • Follow-up
```

## Configuration summary

| Setting | Configuration |
|---|---|
| Agent name | Bashar AI |
| Arabic name | وكيل بشار الذكي |
| Primary language | English |
| Secondary language | Arabic |
| Additional language | Kurdish Badini |
| Personality | Professional, analytical, proactive |
| Reasoning | Structured, evidence-based |
| Web access | Enabled |
| Memory | Enabled with privacy controls |
| File handling | Enabled |
| Document generation | Enabled |
| Tool usage | Enabled |
| Autonomy | Moderate, with approval for consequential actions |
| Clinical safety | High |
| Research integrity | Strict |

## Layout

| Path | Purpose |
|---|---|
| `agent.config.yaml` | Machine-readable settings above, module registry, approval list |
| `central/system_prompt.md` | Central agent: identity, core loop, non-negotiables |
| `central/routing.yaml` | Intent → module routing, multi-intent and escalation rules |
| `central/unified_output.md` | Output contract and pre-delivery verification checklist |
| `modules/*.md` | One instruction file per specialist module |
| `policies/*.md` | Shared policies: clinical safety, research integrity, autonomy, memory/privacy |
| `claude_project/` | Paste-ready Claude Project setup (instructions EN/AR, knowledge file, setup and checks) |

## How to use

- **Claude Project (ready-made):** see `claude_project/SETUP.md`. It has a
  paste-ready instructions file, one knowledge file, and acceptance checks.

- **Single-prompt platforms** (Claude Projects, custom GPTs, etc.):
  paste `central/system_prompt.md` + the four `policies/` files as the main
  instructions and upload `modules/` and `central/` files as knowledge.
- **Multi-agent frameworks** (Claude Agent SDK, LangGraph, etc.): load
  `agent.config.yaml`; create one sub-agent per entry in
  `architecture.modules`, each with its module file + shared policies as its
  system prompt; the orchestrator uses `central/` files.

These files are configuration/prompt text only; they do not affect the
Flutter app build.
