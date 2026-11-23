import type { Metadata } from "next"
import { HistoryView } from "@/components/auth/history-view"

export const metadata: Metadata = {
  title: "History – MetaLens",
  robots: { index: false },
}

export default function HistoryPage() {
  return <HistoryView />
}
