"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

type LoginFormProps = {
    onLogin: (username: string) => void
    isConnected: boolean
    error?: string | null
}

export function LoginForm({ onLogin, isConnected, error }: LoginFormProps) {
    const [username, setUsername] = useState("")

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (username.trim() && isConnected) {
            onLogin(username)
        }
    }

    return (
        <div className="flex flex-col h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <h1 className="text-2xl font-bold mb-6 text-center">Join the Chat</h1>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <Input
                            id="username"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && username.trim() && isConnected) {
                                    onLogin(username)
                                }
                            }}
                        />
                    </div>

                    <Button className="w-full" onClick={() => onLogin(username)} disabled={!username.trim() || !isConnected}>
                        {!isConnected ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Connecting...
                            </>
                        ) : (
                            "Join Chat"
                        )}
                    </Button>
                </form>
            </div>
        </div>
    )
}
