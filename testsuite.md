# Slop Detector Test Suite

10 paste-and-check scenarios for http://localhost:3000. Expectations are ranges,
not exact numbers — Jev returns calibrated probabilities, so borderline cases
(review ±) may wobble between runs.

## 1. Obvious slop → FLAG
Delve into this tapestry of cutting-edge synergy. In today's fast-paced digital landscape, it's important to note that excellence isn't just a goal — it's a journey. Our robust, seamless, game-changing solution leverages holistic best practices to unlock unparalleled, transformative outcomes. Moving forward, success is not an option, but a paradigm shift.
- Expect: FLAG, bucket=slop, slop_index ≥ 2.5, cliche/specificity/formula high.

## 2. Clean human incident note → PASS
Deploys failed at 14:02 UTC with exit 137 on api-2. Rolled back to build 481 and the error stopped. Memory limit was 512MB; bumped to 1GB in prod.conf. Watching the dashboard for the next hour.
- Expect: PASS, bucket=human, all scores ≤ 1, is_slop ≤ 0.5.

## 3. Tricky mixed (hype + one real fact) → REVIEW or FLAG
In conclusion, it is worth mentioning that this cutting-edge approach is truly transformative and will revolutionize how teams collaborate. Onboarding took one afternoon, but the docs never mention that you must set SSO_CALLBACK_URL or logins loop forever.
- Expect: bucket=mixed, slop_index 1.5–2.0, specificity low (it spots the fact), formula/hype elevated. Verdict depends on is_slop vs threshold.

## 4. Listicle spam → FLAG (repetition)
Here are 5 amazing reasons our platform wins. Reason 1: it wins on speed. Reason 2: it wins on scale. Reason 3: it wins on simplicity. Reason 4: it wins on security. Reason 5: it wins on support. That's why it wins.
- Expect: FLAG, repetition ≥ 2.5.

## 5. Hedge stack → FLAG (weasel)
This may potentially arguably be one of the most significant developments that could possibly transform how teams might collaborate, seemingly delivering arguably unprecedented value in certain contexts, all things considered.
- Expect: weasel ≥ 2.5, specificity ≥ 2 (nothing checkable), bucket=slop or mixed.

## 6. Negation-pivot sermon → FLAG (formula)
It's not just a database, it's a philosophy. Not a tool, but a transformation. What is data, really? The answer might surprise you. This isn't about storage — it's about destiny.
- Expect: formula ≥ 2.5 (negation pivots + rhetorical Q&A + fragments).

## 7. Genuine marketing with receipts → PASS or REVIEW
Our sync engine moved 2M rows in 41 seconds on a $20 VPS last Tuesday. p99 latency is 180ms at 500 concurrent writers. Free tier includes 10GB; no credit card required.
- Expect: bucket=human or mixed, specificity ≤ 1 (concrete numbers!), hype ≤ 1.5. The discrimination case: marketing that survives because it's checkable.

## 8. Terse human note → PASS (short-text behavior)
lgtm, ship it
- Expect: PASS. Short inputs carry little signal; watch for over-flagging here — if this flags, thresholds need work.

## 9. Hype launch tweet → REVIEW or FLAG
🚀 HUGE news!! We're THRILLED to announce our REVOLUTIONARY AI-powered game-changer is finally LIVE!! This is going to be ABSOLUTELY transformative!! Don't miss out!! 🔥🔥
- Expect: hype ≥ 2, bucket=slop or mixed. Tests caps/emoji emphasis, a different flavor from corporate slop.

## 10. Non-English paragraph → uncertain
En el vertiginoso panorama digital actual, es importante destacar que nuestra solución robusta e integral aprovecha las mejores prácticas holísticas para ofrecer resultados transformadores sin precedentes.
- Expect: unknown — Jev's own docs say English is the primary training language. If this scores like #1, great; if it passes, that's a known coverage gap, not a rubric bug. Record the outcome.
