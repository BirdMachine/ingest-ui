# Ingest UI mock-server demo

This branch runs the original React UI against an isolated, synthetic API. It starts from Jessica Waldrip / BirdMachine's last upstream commit, [`156b709c2776810eae360bbe49eb0f00a808124b`](https://github.com/hubmapconsortium/ingest-ui/commit/156b709c2776810eae360bbe49eb0f00a808124b), dated July 30, 2026. The fork's `main` preserves that exact snapshot; demo changes live on `demo/mock-server`.

## Run locally

Use Node.js 24 and npm. From the repository root:

```sh
CYPRESS_INSTALL_BINARY=0 npm --prefix src ci --ignore-scripts
npm run demo
```

Open the URL printed by Vite (normally http://localhost:8585). No `.env`, institutional login, tokens, database, or HuBMAP infrastructure is needed. Demo mode overrides API endpoints and disables Datadog and Google Analytics. Ordinary `npm --prefix src start` and `npm --prefix src run build` retain the original behavior.

## Demonstration walkthrough

1. Search and filter the 60 fictional donors, samples, datasets, and uploads. Try `HBM001.DEMO.001`, wildcard `HBM00*`, entity types, groups, date windows, sorting, CSV export, and pagination.
2. Open a donor at `/donor/00000000000000000000000000000001`, edit its description, and update it. The ordinary UI validation and success dialogs remain in use.
3. Use **Individual → Donor** to create a simulated donor, or open `/new/upload` to create an upload. For a donor's protocol field, a syntactically accepted fictional DOI is `https://doi.org/10.17504/protocols.io.synthetic-demo`.
4. Use **Reset demo** to restore the starting records.

All records, identifiers, people, groups, and protocol references are fictional. No actual donor data is included. The demo is independent and unofficial; original licensing and notices remain in `license.txt`.

## Scope and limitations

- Search supports the subset of Elasticsearch query clauses produced by this UI: bool, match, term(s), range, multi-match and query-string wildcards. This is not an Elasticsearch emulator.
- Record reads and ordinary create/update flows are simulated. Viewing sample/dataset lineage is seeded with small synthetic ancestor chains.
- Bulk TSV processing, metadata validation pipelines, Globus transfers, submission/publication, DOI registration, notifications and spatial RUI editing are not implemented. Unsupported API actions return an explicit error, never a fabricated success or a request to a real backend.
- Each browser tab gets its own demo session. State is kept in server memory, expires after one hour without requests, and resets on a server restart. The server retains up to 128 sessions, evicting the oldest when full. This is intentionally disposable; do not enter real records or personal data.
- Demo login is a synthetic session automatically installed on startup. It is not authentication and cannot be used with real HuBMAP APIs.

## Build and serve as one process

```sh
npm run build:demo
PORT=8585 npm start
```

The small Node server serves both the built UI (including deep routes) and `/mock/*`. `render.yaml` provides a free-tier deployment configuration for this branch. Free hosting may sleep when idle, so open it before a scheduled demonstration.

```sh
npm run test:demo
npm --prefix src run test:v
```

The demo API tests exercise combined queries, pagination, record mutation, session isolation, reset, validation and unsupported actions. The existing Vitest tests check the original UI helpers and behavior.
