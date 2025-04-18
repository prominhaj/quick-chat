"use client"

import { useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Send, Loader2 } from "lucide-react"
import type { FormEvent } from "react"

type MessageInputProps = {
    placeholder: string
    onSubmit: (content: string) => void
    onTyping: () => void
    isSending: boolean
    isConnected: boolean
}

export function MessageInput({ placeholder, onSubmit, onTyping, isSending, isConnected }: MessageInputProps) {
    const inputRef = useRef<HTMLInputElement>(null)

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = e.currentTarget
        const formData = new FormData(form)
        const content = formData.get("message") as string

        if (!content.trim()) return

        onSubmit(content)
        form.reset()
        inputRef.current?.focus()
    }

    return (
        <div className="border-t dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
            <form className="flex items-center gap-2" onSubmit={handleSubmit}>
                <Input
                    ref={inputRef}
                    className="flex-1"
                    placeholder={placeholder}
                    name="message"
                    autoComplete="off"
                    disabled={!isConnected || isSending}
                    onChange={onTyping}
                />
                <Button type="submit" disabled={!isConnected || isSending} size="icon">
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    <span className="sr-only">Send message</span>
                </Button>
            </form>
        </div>
    )
}
