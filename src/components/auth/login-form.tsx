"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/lib/api-client"

export function LoginForm() {
  const router = useRouter()
  const client = useQueryClient()
  const { data: session, isPending } = useQuery({
    queryKey: ["session"],
    queryFn: api.session,
  })
  const [mode, setMode] = useState<"login" | "register">("login")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const submit = useMutation({
    mutationFn: async () => {
      if (mode === "login") await api.login({ email, password })
      else await api.register({ name, email, password })
    },
    onSuccess: async () => {
      setPassword("")
      await client.invalidateQueries({ queryKey: ["session"] })
      router.push("/history")
    },
  })
  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    submit.mutate()
  }
  const registering = mode === "register"

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 items-center px-4 py-16">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-lg">
            {registering ? "Create an account" : "Sign in"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Accounts are only needed for saved history.
          </p>
        </CardHeader>
        <CardContent>
          {!isPending && !session?.authEnabled ? (
            <p className="text-sm text-muted-foreground">
              Accounts are off. Set DATABASE_URL and AUTH_SECRET on the server
              to enable history.
            </p>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              {registering ? (
                <div className="space-y-1.5">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="name"
                    required
                    maxLength={80}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={
                    registering ? "new-password" : "current-password"
                  }
                  required
                  minLength={registering ? 10 : undefined}
                  maxLength={200}
                />
              </div>
              {submit.isError ? (
                <p role="alert" className="text-sm text-destructive">
                  {submit.error.message}
                </p>
              ) : null}
              <Button
                type="submit"
                className="w-full"
                disabled={submit.isPending}
              >
                {registering ? "Create account" : "Sign in"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                  setMode(registering ? "login" : "register")
                  submit.reset()
                }}
              >
                {registering
                  ? "I already have an account"
                  : "Create an account"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
