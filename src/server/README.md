# Server modules

Server-only code lives here, separate from UI components. Each service is added in the phase that needs it.

| Module              | Responsibility                                   | Phase |
| ------------------- | ------------------------------------------------ | ----- |
| `services/upload`   | File validation and size-limited request parsing | 2     |
| `services/metadata` | ExifTool output normalization and extraction     | 3     |
| `services/image`    | Image properties and AI preview sanitizing       | 3     |
| `services/location` | Coordinate conversion and reverse geocoding      | 4     |
| `services/analysis` | Completeness, missing fields, consistency checks | 6     |
| `services/report`   | JSON, CSV, and PDF exports                       | 7     |
