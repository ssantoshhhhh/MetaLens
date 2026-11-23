/** Copies the ExifTool WebAssembly runtime into public/ so the browser can load it. */
import { copyFile, mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const entry = require.resolve("@6over3/zeroperl-ts")
const packageRoot = entry.slice(
  0,
  entry.lastIndexOf("zeroperl-ts") + "zeroperl-ts".length,
)
const source = path.join(packageRoot, "dist/esm/zeroperl.wasm")
const target = path.join(process.cwd(), "public/exiftool/zeroperl.wasm")

await mkdir(path.dirname(target), { recursive: true })
await copyFile(source, target)
