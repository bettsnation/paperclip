# PropertyBetts AI Property Analysis Pipeline

## Overview

Enrich 54 off-market target properties in Midlothian, TX with AI-driven analysis to rank deal readiness and generate actionable profiles for direct outreach. These are personal home search targets — cul-de-sac, pool, 4+bd/3+ba, 0.5+ acres, $400-800K appraised value.

## Data Already Available (PropertyBetts DB)

Each of the 54 properties already has:
- Address, city, school district (Midlothian ISD)
- Owner name (from county appraisal records)
- Appraised value, sqft, bedrooms, bathrooms, stories, lot acres
- Pool (confirmed), cul-de-sac street suffix
- Years owned, deed date
- Target score (scoring signals: absentee, homestead, OOS, years owned)
- Geocoded lat/lng coordinates

**Database:** PostgreSQL on `10.0.25.20:5434`, tables `parcels_parcel` + `parcels_appraisalrecord`
**Target lists:** "Midlothian Personal — 1 Story" (25 properties), "Midlothian Personal — 2 Story" (29 properties)

---

## AI Enrichment Agents

### Agent 1: Visual Property Assessment

**Input:** Lat/lng coordinates for each property
**Tools:** Google Maps Street View API, Google Satellite API, GPT-4o Vision
**Process:**
1. Pull Street View image (front of property) and satellite image (lot overview)
2. Send both to GPT-4o Vision with prompt:
   - Assess curb appeal (1-10): landscaping, roof condition, paint, driveway
   - Estimate property condition: excellent / good / fair / needs work
   - Identify visible features: fence type, garage size, outbuildings, RV pad
   - Flag concerns: overgrown yard, deferred maintenance, construction activity
   - Describe neighborhood character from surrounding properties
3. Store assessment as structured JSON on the Lead or Parcel record

**API:** Google Maps API key already configured in PropertyBetts (`GOOGLE_MAPS_API_KEY`)
**Cost:** ~$0.007/image (Street View) + ~$0.01/GPT-4o Vision call = ~$0.52 for 54 properties

### Agent 2: Market Comp Analysis

**Input:** Property address, appraised value, sqft, lot size
**Tools:** Public records search, MLS data (if accessible), Zillow/Redfin scraping or API
**Process:**
1. Find 3-5 comparable recent sales within 0.5 mile radius (same school district, similar sqft/lot)
2. Calculate estimated market value vs county appraised value
3. Identify equity gap: if market value significantly exceeds appraised, owner has equity motivation
4. Check if property has been listed on MLS in last 2 years — recently listed and pulled = motivated seller
5. Check for price reductions on nearby listings (market softness indicator)

**Output per property:**
- Estimated market value
- Equity estimate (market value - appraised value)
- Recent listing history (listed/sold/expired/withdrawn)
- Neighborhood market trend (appreciating/stable/declining)

### Agent 3: Owner Intelligence

**Input:** Owner name, property address, owner mailing address (from appraisal records)
**Tools:** Public records APIs, skip trace services, social media search
**Process:**
1. Skip trace for phone number and email (services like Tracerfy at $0.02/lead)
2. Check for life event signals:
   - Divorce filings in county records
   - Tax liens or delinquent taxes
   - Other properties owned (multi-property owner = investor, may be liquidating)
   - Bankruptcy filings
   - Obituary search (recent death in family = potential estate situation)
3. Estimate owner age/life stage from years owned + public records
4. Check if owner mailing address differs from property (absentee indicator)

**Output per property:**
- Phone number(s), email
- Life event flags
- Number of other properties owned
- Owner profile: "Long-term resident, likely empty nester, no distress signals"

### Agent 4: Neighborhood & Livability Score

**Input:** Lat/lng, school district
**Tools:** Public data APIs, Census data, school rating APIs
**Process:**
1. School ratings for Midlothian ISD (elementary, middle, high)
2. Proximity to amenities: grocery, restaurants, parks, hospitals
3. Crime statistics for the area
4. HOA lookup (if applicable)
5. Flood zone check (FEMA data)
6. Commute time to key destinations (downtown Dallas, DFW Airport, etc.)

**Output:** Livability score and neighborhood profile

### Agent 5: Deal Readiness Scoring

**Input:** All outputs from Agents 1-4 + existing parcel data
**Tools:** GPT-4o for synthesis
**Process:**
1. Combine all signals into a weighted deal readiness score:
   - Owner tenure (longer = more equity, possibly more motivated) — 20%
   - Property condition (needs work = negotiation leverage) — 15%
   - Market equity gap (below market = good deal potential) — 20%
   - Owner life events (divorce, death, tax issues = motivation) — 20%
   - Listing history (never listed = true off-market) — 10%
   - Neighborhood/livability match to buyer criteria — 15%
2. Generate a one-paragraph AI profile for each property
3. Rank all 54 properties by deal readiness score

**Output per property:**
```
#3 — 4061 Steeplechase CT, Midlothian
Score: 87/100 | Appraised: $573K | Est. Market: $650K
Owner: Moore Jared & Sally (22 years) | 2.03 acres | 6,255 sqft | 5bd/4ba | 1-story | Pool
Assessment: Well-maintained ranch on 2 acres, mature landscaping. Long-term owners likely
empty nesters with significant equity. No recent listing activity — true off-market.
Recommended approach: Personal handwritten letter emphasizing neighborhood connection.
```

---

## Implementation Options

### Option A: Fully Automated Pipeline
Build as Celery tasks in PropertyBetts backend. Trigger on target list creation. Results stored in Lead qualification_data JSONField. Estimated build: 2-3 days.

### Option B: Paperclip Agent Workflow
Define as a Paperclip multi-agent workflow:
1. Agent 1 (Vision) runs in parallel across all 54 properties
2. Agent 2 (Comps) runs in parallel
3. Agent 3 (Owner Intel) runs in parallel
4. Agent 4 (Neighborhood) runs once for the area
5. Agent 5 (Synthesis) runs after 1-4 complete, produces final ranked report
Results pushed back to PropertyBetts via API.

### Option C: Hybrid
Use PropertyBetts for data retrieval (parcel data, geocoding, Street View images) and Paperclip agents for AI analysis and synthesis.

---

## Data Flow

```
PropertyBetts DB (54 parcels)
    ↓
Agent 1: Street View + Satellite → GPT-4o Vision → condition assessment
Agent 2: Address → comp search → market value estimate
Agent 3: Owner name → skip trace + public records → contact info + life events
Agent 4: Lat/lng → public APIs → neighborhood profile
    ↓
Agent 5: All signals → GPT-4o synthesis → ranked deal readiness report
    ↓
PropertyBetts Lead records (qualification_data JSON updated)
    ↓
Frontend: enriched Lead detail view with AI assessment tab
```

---

## Estimated Costs (54 properties)

| Service | Per Property | Total |
|---------|-------------|-------|
| Google Street View API | $0.007 | $0.38 |
| Google Satellite API | $0.007 | $0.38 |
| GPT-4o Vision (2 images) | $0.01 | $0.54 |
| GPT-4o text (comp analysis + synthesis) | $0.02 | $1.08 |
| Skip trace (Tracerfy) | $0.02 | $1.08 |
| **Total** | **~$0.06** | **~$3.46** |

---

## Priority & Next Steps

1. Start with Agent 1 (Visual Assessment) — immediate value, all APIs available
2. Add Agent 5 (Deal Readiness) — synthesis of existing data + visual assessment
3. Add Agent 2 (Comps) — requires MLS data source decision
4. Add Agent 3 (Owner Intel) — requires skip trace service signup
5. Agent 4 (Neighborhood) — one-time for Midlothian area, lowest priority

---

*Created 2026-04-14 — PropertyBetts personal home search enrichment*
