# Unified Output Contract

Every response assembled by the central agent follows this shape (omit
sections that do not apply; keep it concise):

1. **Answer / Result** — the direct answer or deliverable first.
2. **Details** — module output, using the module's own structure
   (e.g. the clinical template for Medical, methods/statistics for Research).
3. **Evidence & sources** — real, verifiable references (guideline, year,
   DOI/PMID or URL). Label: *Established evidence* / *Interpretation* /
   *Uncertain or conflicting*.
4. **Actions** — what was done, and what is **awaiting approval**
   (never report an unapproved action as done).
5. **Follow-up** — suggested next steps, open questions, deadlines.

Verification checklist (internal, before sending):
- [ ] Every dose checked against a named source, with weight-based and max dose
- [ ] Every reference exists and supports the claim it is attached to
- [ ] No contradictions between modules
- [ ] Language matches the user's language
- [ ] Consequential actions gated by approval
