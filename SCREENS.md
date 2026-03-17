# Screen List

## 1. Character page — `/characters/[id]`

Purpose:
- view current published version
- create/edit draft version

Panels:
- persona summary
- values / flaws
- style sliders
- autonomy controls
- emotion tuning
- memory policy
- prompt bundle reference

## 2. Phase editor — `/characters/[id]/phases`

Purpose:
- build and edit free-form phase graph

Panels:
- graph canvas
- selected node editor
- selected edge condition builder
- authored notes
- girlfriend-mode settings

Need:
- node add/remove
- edge add/remove
- condition builder UI

## 3. Memory view — `/characters/[id]/memory`

Purpose:
- show memory model to designers

Panels:
- working memory
- recent episodic events
- graph facts
- observation blocks
- open threads
- superseded items

## 4. Playground — `/playground`

Purpose:
- live side-by-side testing

Modes:
- single version
- compare A vs B

Panels:
- chat surface
- current phase
- current PAD state
- retrieved memory list
- planner JSON
- candidate scorecards

## 5. Evals — `/evals`

Purpose:
- run scenario packs and inspect results

Panels:
- scenario set selector
- version selector
- scorer summary
- per-case results
- failing-case drilldown

## 6. Trace viewer — `/traces/[id]`

Purpose:
- explain one specific turn

Sections:
- request input
- pair state before
- retrieved memory
- appraisal vector
- PAD before/after
- planner output
- candidates
- ranker scores
- memory writeback
- final output

## 7. Releases — `/releases`

Purpose:
- manage publish / rollback

Panels:
- current live version
- historical releases
- publish action
- rollback action
- attached eval summaries

## 8. Minimal navigation for MVP

Left nav:
- Characters
- Playground
- Evals
- Releases

Character subnav:
- Overview
- Phases
- Memory
