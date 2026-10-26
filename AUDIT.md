# Data & site audit — 26 Oct 2026

Source of truth: LIC Premium Due Lists for agent LIC01891914, 04/2025 to 05/2026 (14 lists).
All 14 parse completely and every list ties to LIC's own printed Grand Total. 149 unique policies.

## What was wrong in the old page

| # | Finding | Impact |
|---|---------|--------|
| 1 | No "paid" state. Every LIC policy was shown as lapsed/at-risk. 70 of 146 had actually cleared their premium per LIC's own later lists (e.g. 907668027 Lalsadevi R Chauhan shown ₹29,731 lapsed; LIC shows it paid). | Arrears overstated by **₹5,71,945**; clients who paid would get chase messages. |
| 2 | 131 policies that never appear on any LIC list in 14 months were counted as "Lapsed Long-Term / at-risk". | Headline "Total lapsed / at-risk 279" was inflated; these are matured, paid-up, surrendered or long-lapsed and need a branch check, not collection calls. |
| 3 | Date frozen at 9 Jul 2026 (hard-coded), while the newest LIC data is May 2026. | Arrears and late fees 3.5 months stale; page gave no warning that data was old. |
| 4 | 1 LIC policy missing entirely (911583498 Santosh Chauhan, ₹18,747 unpaid). 2 policies wrongly marked "not in LIC list" (902967494, 903894022) because a wrapped PDF row was not parsed. | Missed money; wrong labels. |
| 5 | Names from the client sheet used for messages. 62 differ from LIC records; some point at the wrong person (903104594 is RAMBHAJAN Dipchand Chauhan, sheet says Ram Dipchand; 907673533 is CHANDRAPRAKASH, sheet says Chandrakant). | WhatsApp/notice addressed to the wrong family member. |
| 6 | Instalments were counted by month only, ignoring the commencement day, so premiums not yet due were added (e.g. 903891653 counted 3 on 9 Jul when the third falls due 13 Jul). | Small over-counts on several policies. |
| 7 | 96 of 149 LIC policies have no phone number in the client sheet (85 of the policies that owe money now). | Most of the book cannot be contacted from the dashboard. |
| 8 | Client names, phones and policy numbers are on a public GitHub Pages URL. | Privacy exposure; anyone with the link (or a search engine) can read it. `noindex` added; access control still needed. |
| 9 | Data was pasted into the page (217 KB single file) with no way to refresh it. | Every update needed a manual rebuild. |

## What the page now does

- Policy state is derived from LIC's lists only: on the latest list = **Overdue (LIC confirmed)**; dropped off within 5 months of its first unpaid premium = **paid**; fell off 6+ months after = **Lapsed, revivable**; MT/LP flag then paid = **Completed**.
- Everything is recalculated to the viewer's date on every load. Anything after the latest LIC list is labelled *est.* and a banner names the missing months.
- Call queue groups policies by phone number (one call per household), sorted by urgency and amount.
- Policy drawer: exact LIC-printed amount vs today's estimate, 14-month LIC history, notice PDF, outcome + note.
- "Needs verification" tab for the 133 off-list policies with a field to record what the branch says.
- Call log with CSV export; call outcomes saved under the same browser key as the old page, so nothing is lost.

## To refresh

Download the newest Premium Due Lists from the LIC agent portal, then run
`python3 tools/build_data.py <folder of PDFs> <client_roster.json>` to regenerate `data.js`.
