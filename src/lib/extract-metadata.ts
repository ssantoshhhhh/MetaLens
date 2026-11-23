const WASM_URL = "/exiftool/zeroperl.wasm"
const ARGS = ["-json", "-long", "-a", "-u", "-G0:1:4"]

export type ExtractedMetadata = {
  record: Record<string, unknown>
  tempName: string
}

/** Runs ExifTool in this browser, so the image itself is never uploaded. */
export async function extractMetadata(
  file: File,
  extension: string,
): Promise<ExtractedMetadata> {
  const { parseMetadata } = await import("@uswriting/exiftool")
  const tempName = `${crypto.randomUUID()}.${extension}`
  const result = await parseMetadata<Record<string, unknown>[]>(
    { name: tempName, data: file },
    {
      args: ARGS,
      fetch: () => fetch(WASM_URL),
      transform: (data) => JSON.parse(data) as Record<string, unknown>[],
    },
  )
  const record = result.success ? result.data[0] : undefined
  if (!record) throw new Error("Metadata could not be extracted.")
  return { record, tempName }
}
