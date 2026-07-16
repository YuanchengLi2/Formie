# Coaching accuracy evaluation

Use the same labeled recordings every time the analysis prompt or model changes. This separates real improvement from a result that merely sounds more confident.

## Build the test set

Record at least 20 sets across five or more exercises. For each exercise include a clean set, a poorly performed set, an unusual variation, and a set where technique changes near the end. A person reviewing the original video should label:

- the nearest standard exercise name;
- the most important visible correction and two or three words that must appear in it;
- the timestamp where that correction is clearest.

Store one JSON object per line:

```json
{"id":"curl-late-drift","expectedExercise":["hammer curl","dumbbell curl"],"expectedPriorityKeywords":["elbow","forward"],"expectedEvidenceMs":8300,"result":{"recognition":{"label":"Hammer Curl"},"priorityCorrections":[{"title":"Elbow drift","detail":"The elbows moved forward on the final repetitions.","correction":"Keep the upper arms beside the torso.","cue":"Only the forearms move.","evidence":[{"peakMs":8350}]}],"verification":{"performed":true,"outcome":"confirmed","usage":{"promptTokens":120,"outputTokens":30,"thinkingTokens":10}}}}
```

Run:

```powershell
npm run evaluate:coaching -- .\path\to\labeled-results.jsonl
```

The optional final argument changes the evidence tolerance from the default 750 ms.

## Initial release gates

- Exercise recognition: at least 90%, including bad attempts and unusual variations.
- Human agreement with the top correction: at least 80%.
- Evidence peak within 750 ms of the human label: at least 80%.
- Coaching that talks about the camera or recording setup: at most 2%.
- Blatantly unusable videos should stop after the video check; usable poor attempts should not be rejected.

Review every item in `failures`, not only the aggregate rates. Repeat the exact test set before and after a change, and only keep the change when the measures improve without increasing unsupported claims.
