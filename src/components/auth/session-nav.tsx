"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { clearPreviews } from "@/lib/preview-store"

export function SessionNav() {
  const client = useQueryClient()
  const router = useRouter()
  const { data } = useQuery({ queryKey: ["session"], queryFn: api.session })
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: async () => {
      clearPreviews()
      client.removeQueries({
        predicate: (query) => query.queryKey[0] !== "session",
      })
      await client.invalidateQueries({ queryKey: ["session"] })
      router.push("/")
    },
  })
  if (!data?.authEnabled) return null
  if (!data.user) {
    return (
      <Button asChild variant="ghost" size="sm">
        <Link href="/login">Sign in</Link>
      </Button>
    )
  }
  return (
    <>
      <Button asChild variant="ghost" size="sm">
        <Link href="/history">History</Link>
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => logout.mutate()}
        disabled={logout.isPending}
      >
        Sign out
      </Button>
    </>
  )
}
