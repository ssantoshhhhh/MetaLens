# Server modules

Server-only code lives here, separate from UI components. Each service is added in the phase that needs it.

| Module              | Responsibility                                   | Phase |
| ------------------- | ------------------------------------------------ | ----- |
| `services/upload`   | Validation, temporary files, cleanup             | 2     |
| `services/metadata` | ExifTool integration and complete metadata JSON  | 3     |
| `services/image`    | Dimensions, format, properties, thumbnails       | 3     |
| `services/location` | Coordinate conversion and reverse geocoding      | 4     |
| `services/analysis` | Completeness, missing fields, consistency checks | 6     |
| `services/report`   | JSON, CSV, and PDF exports                       | 7     |
