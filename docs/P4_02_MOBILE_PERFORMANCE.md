# P4-02 — Mobile performance and slow-connection baseline

## Scope

This checkpoint is intentionally narrow: measure the current public homepage under a constrained mobile profile, identify a demonstrated bottleneck, remove only that cost, and keep content/decision/evidence semantics unchanged.

No production deployment is part of this Draft PR.

## Reproducible baseline

Measured against the current production homepage on 2026-08-18 with Chrome 151.0.7922.108:

- viewport: `390 × 844`
- device scale factor: `2`
- network latency: `150 ms`
- download throughput: `1.6 Mbps`
- upload throughput: `750 Kbps`
- CPU slowdown: `×4`
- cache: disabled
- runs: `3`
- aggregation: median

Median result:

| Metric | Baseline |
| --- | ---: |
| TTFB | 1017.2 ms |
| FCP | 1884 ms |
| LCP | 1884 ms |
| load event | 1841.6 ms |
| CLS | 0 |
| long tasks | 1 |
| long-task time | 98 ms |
| total transfer | 191,430 B |
| image transfer | 30,438 B |
| CSS transfer | 23,509 B |
| resource count | 20 |

The three LCP samples were `2924 ms`, `1884 ms`, and `1724 ms`. The three page samples had no horizontal overflow.

## Demonstrated unnecessary cost

The homepage automatically fetched linked React Server Component routes before the visitor asked to navigate. Among the measured top resources were:

- `/titles.rsc`: 4,994 B
- `/review-policy.rsc`: 4,498 B
- `/.rsc`: 4,373 B
- `/corrections.rsc`: 4,038 B

Those four observed prefetches alone account for **17,903 B**, or about **9.35%** of the measured 191,430 B transfer, plus four unnecessary request/latency cycles.

The baseline does **not** support treating artwork as the primary problem: measured image transfer was only 30,438 B and CLS was zero. Therefore this checkpoint does not degrade image quality or remove artwork.

## Change

All `next/link` instances rendered by the homepage now set `prefetch={false}`. Navigation remains available on click; only speculative route fetching is removed.

This is deliberately a homepage policy rather than a global framework change. Other routes can keep their existing behavior until measured independently.

## Regression contract

`tests/mobile-performance-contract.test.ts` requires every homepage `Link` to keep `prefetch={false}`.

The temporary browser QA for this checkpoint must also prove, on an isolated local D1 preview, that:

1. the homepage renders without horizontal overflow on `390 × 844`;
2. no linked `.rsc` route is fetched speculatively while the visitor remains on the homepage;
3. an actual click still navigates successfully.

After the QA evidence is captured, the temporary workflow is removed before Work review.
