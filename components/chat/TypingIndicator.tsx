import { UserAvatar } from "@/components/chat/UserAvatar"
import type { User } from "@/lib/types"

type TypingIndicatorProps = {
    user?: User
    isTyping: boolean
    className?: string
}

export function TypingIndicator({ user, isTyping, className }: TypingIndicatorProps) {
    if (!isTyping) return null

    return (
        <div
            className={`flex items-center space-x-2 text-sm bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md text-gray-600 dark:text-gray-300 mt-2 ${className}`}
        >
            {user && <UserAvatar src={user.avatar} username={user.username} status={user.status} size="sm" />}
            <span>{user ? `${user.username} is typing` : "Someone is typing"}</span>
            <span className="flex">
                <span className="animate-bounce mx-0.5">.</span>
                <span className="animate-bounce animation-delay-200 mx-0.5">.</span>
                <span className="animate-bounce animation-delay-400 mx-0.5">.</span>
            </span>
        </div>
    )
}
