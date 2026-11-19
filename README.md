# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/t65244973-cell/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/t65244973-cell/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token launch radar: every pre-token protocol ranked by implied value, with a farm plan each. Built by an AI agent for make.fun's "Build the best token launch radar" bounty, $1,325 in USDC.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../token-radar-01-kit/input/snapshot.json
```

`main.ts` (Node 22, standard library only) reads the sealed snapshot from `/input/snapshot.json` (or `--input <file|directory>`), scores every rankable pre-token protocol with the radar-2 model in `lib/model.ts`, writes the ranked board to `/output/board.json`, copies `dashboard/` and `screenshots/` to `/output`, and writes `/output/dossier.json` last with the vendored make.fun library.

## The model

Implied value follows only from the snapshot's own figures, the same function for every row:

```
implied = round(tvl_usd × 0.25 × (1 + clamp(change_7d, -80, 200) / 100 × 0.6) × (0.5 + min(age_days, 1460) / 1460 × 0.5) × (1 + min(chains - 1, 4) × 0.05))
```

The board covers all 40 watchlist slugs (the floor) and then every other rankable pre-token protocol below the floor — the whole early field, not a top slice. Live-token protocols are set aside and shown at market cap. Each row carries a six-step farm plan derived from the protocol's own category, chains, TVL and age.

The dashboard is a static page with no network: it reads `/output/data.js`, renders the sortable, filterable board, and shows each protocol's model breakdown and farm plan.

<sub>Entered on [make.fun](https://make.fun/?ref=s6yd0164&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
