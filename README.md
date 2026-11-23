# MetaLens

MetaLens is a full-stack image metadata intelligence platform. Upload an image to see its device, capture time, GPS location, camera settings, and every embedded EXIF, IPTC, XMP, ICC, and maker-note field, then download a report.

MetaLens only reports values found in the file. Missing values are shown as unavailable, and metadata completeness is not proof of authenticity.

## Quick start

Requires Node.js 24 or newer and npm 11 or newer. ExifTool runs in the browser through WebAssembly, so no system install is needed.

```bash
npm install
npm run dev
```

Open http://localhost:3000. No database or API key is needed for core features.

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

## Architecture

```text
src/
  app/            Pages and API route handlers
  components/     Landing, analysis dashboard, auth, and shadcn/ui
  config/         Site content and shared upload rules
  lib/            Shared client/server utilities and API client
  server/
    auth/         Password hashing and signed sessions
    services/
      upload/     Validation and private temp files
      metadata/   ExifTool integration and normalization
      image/      Sharp properties and previews
      location/   GPS conversion and reverse geocoding
      analysis/   Completeness and consistency checks
      report/     JSON, CSV, and PDF exports
      vision/     Optional AI analysis
    store/        Temporary memory store and encrypted database store
  types/          Shared TypeScript contracts
prisma/           Database schema and migrations
docs/openapi.yaml API contract
tests/            Unit tests
```

## API

The full contract is in [`docs/openapi.yaml`](docs/openapi.yaml).

| Method and path                                    | Purpose                |
| -------------------------------------------------- | ---------------------- |
| `POST /api/images/analyze`                         | Analyze an image       |
| `GET /api/images/:id`                              | Get an analysis        |
| `GET /api/images/:id/metadata`                     | Get complete metadata  |
| `GET /api/images/:id/report?format=json\|csv\|pdf` | Download a report      |
| `DELETE /api/images/:id`                           | Delete an analysis     |
| `POST /api/images/:id/geocode`                     | Look up the place name |
| `POST /api/images/:id/vision`                      | Run AI visual analysis |
| `GET /api/history`                                 | List saved analyses    |
| `GET /api/health`                                  | Check backend status   |

## Privacy and security

- Uploads are checked by size, extension, MIME type, and file signature, then processed in a private temporary directory that is always deleted.
- Original images are never stored. Temporary analyses stay in memory for 30 minutes and are private to the browser that created them.
- History is opt-in. GPS, serial numbers, and raw tags are encrypted with AES-256-GCM in the database.
- The map and place lookup run only after the user asks, because they send coordinates to OpenStreetMap services.
- AI analysis runs only after the user asks, and sends a reduced copy with metadata removed.
- Requests have rate limits, cross-origin protection, and security headers. Metadata is not logged, and CSV exports neutralize spreadsheet formulas.

## Production notes

- Run behind a reverse proxy that overwrites `X-Forwarded-For`, so clients cannot bypass per-client rate limits.
- Rate limits live in process memory, so they apply per instance. Temporary analyses stay in the browser tab.
- HEIC metadata is supported. The server may not decode HEIC pixels, so its preview depends on an embedded thumbnail or browser support.
- PDF reports cover Latin, Greek, Cyrillic, and other DejaVu scripts. CJK text may not render in PDF, but is complete in JSON and CSV.
