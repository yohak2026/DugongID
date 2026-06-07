# DugongID — Adversarial / Specialist Agent Council (Beta)

This is a **review-and-decision process** you run to improve identification quality
and the app itself. The agents are roles you (the human Driver) trigger — by
prompting an AI assistant here in chat. **No API wiring, no automated calls, no
extra running cost** beyond the prompts you choose to send. This keeps the beta
cheap to test while still giving you the full council.

> Beta principle: **Sonnet does the routine work. Premium models run only when
> escalation is needed or for final sign-off.** This is the credit-saving rule —
> see the Escalation Ladder below.

---

## Driver Council (you preside)

| ID | Role | Model | Job |
| -- | ---- | ----- | --- |
| **D1** | Research Leader | GPT-5.6 | Check published research so dorsal-data ID is accurate. Find new marker methods. Translate cetacean ID science into dugong dorsal markers. |
| **D2** | Head of Development | Claude 4.8 | Produce one coherent, evidence-backed identification result. Make sure every department's output is supported by documents/evidence. |
| **D3** | Observatory Leader | Gemini 3.1 | Run the 4 ID methods (shallow lacerations · dorsal cuts & deformities · fluke shape · dorsal pigmentation) against body regions (anterior / medial / posterior / tail / head). Ensure findings are replicable. |
| **D4** | Presider of Outputs | (Council) | Collate D1 + D2 + D3 → decide: is this a **new individual** or one of the **already-identified 12 dugongs**? |

---

## Specialist teams (called by the Council on demand)

These collapse the original S1–S10 into the capabilities that actually differ, so
you never pay premium rates for duplicate work.

### Observers (photo / drone specialists)
- **Extractor** (Sonnet) — extract marks by permanence + body region into the
  catalog schema. Runs on **every** photo.
- **Discovery** (Opus 4.8) — only when existing markers fail to ID an animal:
  propose *new* ways to mark/identify.

### Marine Biologists
- **ID & Biology** (Sonnet default → Opus on escalation) — ambiguous-match
  resolution, age class, behaviour, and veterinary/health notes (cetacean family,
  dugong-specific, marine-vet knowledge folded into one role).

---

## Escalation Ladder (the credit-saving core)

Run the cheapest tier that resolves the question. Stop as soon as you have a
confident answer.

1. **Sonnet Extractor** annotates the photo → if the catalog match is clean
   (one clear high-confidence candidate, or clearly new), **stop. Done.**
2. **Ambiguous?** (multiple close candidates, or no match) → escalate to
   **Sonnet ID & Biology**.
3. **Still uncertain / dispute / novel marks?** → escalate to **Opus** (Discovery
   or D2) for the hard call.
4. **D4 Presider sign-off** + **GPT-5.5/5.6 verification** runs **once per batch
   or milestone**, never per photo.
5. **Gemini 3.1 UI/UX critique** is a per-iteration pass on the app, not part of
   per-photo ID.

**Result:** most photos never leave step 1, so the expensive models are used only
where they change the outcome.

---

## How to run a review in the beta (here in chat)

1. Send the dorsal/fluke photo(s) and any field notes.
2. Ask for the **Sonnet Extractor** pass → get marks + suggested ID.
3. If it flags ambiguity, ask to **escalate** (the assistant will switch role/model).
4. Ask the **D4 Presider** to collate and give the final new-vs-known decision.
5. Enter the confirmed result into the DugongID app (Identify → Confirm / new).

This document is the source of truth for the council. Update the table if you
change a model assignment.
