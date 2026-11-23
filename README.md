# MetaLens

MetaLens is a full-stack image metadata intelligence platform. Choose an image to see its device, capture time, GPS location, camera settings, and every embedded EXIF, IPTC, XMP, ICC, and maker-note field, then download a report.

MetaLens only reports values found in the file. Missing values are shown as unavailable, and metadata completeness is not proof of authenticity.

## How it works

1. The browser checks the file's size, extension, and signature.
2. ExifTool reads the metadata in the browser through WebAssembly. The image is not uploaded.
3. The browser sends the extracted metadata and the file's first 64 bytes to the server.
4. The server validates and analyzes the metadata, then returns the result.
5. Temporary results stay in the browser tab. Signed-in users can choose to save them to encrypted history.

Images can be up to 25 MB. The metadata request must stay under 4 MB, which keeps it within Vercel's function payload limit.

## Quick start

Requires Node.js 24 or newer and npm 11 or newer. ExifTool runs in the browser through WebAssembly, so no system install is needed.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database or API key is needed for core features.

`npm run dev` and `npm run build` copy the ExifTool WebAssembly runtime to `public/exiftool/`. That generated 25 MB file is ignored by Git.

## Commands

| Command              | Purpose                      |
| -------------------- | ---------------------------- |
| `npm run dev`        | Start the development server |
| `npm run build`      | Create a production build    |
| `npm start`          | Serve the production build   |
| `npm test`           | Run unit tests               |
| `npm run lint`       | Run ESLint                   |
| `npm run typecheck`  | Run the TypeScript compiler  |
| `npm run format`     | Format files with Prettier   |
| `npm run db:migrate` | Apply database migrations    |

## Optional features

Copy `.env.example` to `.env` and set only what you need.

| Variable                         | Enables                                     |
| -------------------------------- | ------------------------------------------- |
| `DATABASE_URL` and `AUTH_SECRET` | Accounts and saved history                  |
| `ANTHROPIC_API_KEY`              | AI visual analysis                          |
| `ANTHROPIC_MODEL`                | AI model override                           |
| `NOMINATIM_URL`                  | A self-hosted geocoder                      |
| `NOMINATIM_USER_AGENT`           | Geocoder identification (set in production) |

To enable history, set both database variables and run `npm run db:migrate`. Changing `AUTH_SECRET` signs everyone out and makes saved analyses unreadable.

### Docker

```bash
docker compose up --build                    # Core app
docker compose --profile history up --build  # App and PostgreSQL
```

For the history profile, set `POSTGRES_PASSWORD`, `AUTH_SECRET`, and `DATABASE_URL=postgresql://metalens:<password>@db:5432/metalens` in `.env`.

### Vercel

Core features need no environment variables or extra services. The default `npm run build` command prepares the WebAssembly runtime. To enable history, add `DATABASE_URL` and `AUTH_SECRET` to the project and run `npm run db:migrate` against that database.

## Architecture

```text
src/
  app/            Pages and API route handlers
  components/     Landing, analysis dashboard, auth, and shadcn/ui
  config/         Site content and shared upload rules
  lib/            API client, browser extraction, and browser result storage
  server/
    auth/         Password hashing and signed sessions
    services/
      upload/     File validation and size-limited request parsing
      metadata/   ExifTool output normalization and field extraction
      image/      Image properties and AI preview sanitizing
      location/   GPS conversion and reverse geocoding
      analysis/   Completeness and consistency checks
      report/     JSON, CSV, and PDF exports
      vision/     Optional AI analysis
    store/        Encrypted database store for saved history
  types/          Shared TypeScript contracts
prisma/           Database schema and migrations
scripts/          Build helper that copies the WebAssembly runtime
docs/openapi.yaml API contract
tests/            Unit tests
```

## API

The full contract is in [`docs/openapi.yaml`](docs/openapi.yaml).

| Method and path                                    | Purpose                                |
| -------------------------------------------------- | -------------------------------------- |
| `POST /api/images/analyze`                         | Analyze browser-extracted metadata     |
| `POST /api/images/report?format=json\|csv\|pdf`    | Build a report for a temporary result  |
| `POST /api/images/geocode`                         | Look up a place for a temporary result |
| `POST /api/images/vision`                          | Run AI analysis for a temporary result |
| `GET /api/images/:id`                              | Get a saved analysis                   |
| `GET /api/images/:id/metadata`                     | Get a saved analysis's metadata        |
| `GET /api/images/:id/report?format=json\|csv\|pdf` | Download a saved analysis report       |
| `DELETE /api/images/:id`                           | Delete a saved analysis                |
| `POST /api/images/:id/geocode`                     | Look up a saved analysis's place       |
| `POST /api/images/:id/vision`                      | Run AI analysis for a saved result     |
| `GET /api/history`                                 | List saved analyses                    |
| `GET /api/health`                                  | Check backend status                   |

## Privacy and security

- Images are read in the browser and are not uploaded for metadata extraction. Extracted metadata, which can include GPS and serial numbers, is sent to the server for analysis.
- The server validates the file details and treats submitted metadata as untrusted data. It does not keep temporary analyses.
- Temporary analyses stay in the browser tab that created them and expire after 30 minutes.
- History is opt-in. GPS, serial numbers, and raw tags are encrypted with AES-256-GCM in the database.
- The map and place lookup run only after the user asks, because they send coordinates to OpenStreetMap services.
- AI analysis runs only after the user asks, and sends a reduced copy with metadata removed.
- Requests have rate limits, cross-origin protection, and security headers. Metadata is not logged, and CSV exports neutralize spreadsheet formulas.

## Production notes

- Run behind a reverse proxy that overwrites `X-Forwarded-For`, so clients cannot bypass per-client rate limits.
- Rate limits live in process memory, so they apply per instance.
- The first analysis downloads the 25 MB WebAssembly runtime, which the browser then caches for up to 7 days.
- HEIC metadata is supported. Previews depend on the browser's ability to decode HEIC.
- PDF reports cover Latin, Greek, Cyrillic, and other DejaVu scripts. CJK text may not render in PDF, but is complete in JSON and CSV.
