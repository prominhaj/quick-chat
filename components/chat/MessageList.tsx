"use client"

import type React from "react"

import { useMemo, useRef } from "react"
import { Separator } from "@/components/ui/separator"
import { UserAvatar } from "@/components/chat/UserAvatar"
import { TypingIndicator } from "@/components/chat/TypingIndicator"
import { MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Message, User } from "@/lib/types"

type MessageListProps = {
    messages: Message[]
    currentUser: User | null
    typingUsers: Record<string, boolean>
    users: User[]
    isTyping: boolean
    messagesEndRef: React.RefObject<HTMLDivElement>
}

export function MessageList({ messages, currentUser, typingUsers, users, isTyping, messagesEndRef }: MessageListProps) {
    const messagesContainerRef = useRef<HTMLDivElement>(null)

    // Format time
    const formatTime = (date: Date) => {
        return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }

    // Format date for message groups
    const formatDate = (date: Date) => {
        const today = new Date()
        const yesterday = new Date(today)
        yesterday.setDate(yesterday.getDate() - 1)

        if (date.toDateString() === today.toDateString()) {
            return "Today"
        } else if (date.toDateString() === yesterday.toDateString()) {
            return "Yesterday"
        } else {
            return date.toLocaleDateString()
        }
    }

    // Group messages by sender and date
    const groupedMessages = useMemo(() => {
        const groups: {
            senderId: string
            senderName: string
            senderAvatar: string
            senderStatus?: "online" | "away" | "offline"
            date: string
            messages: { id: string; content: string; timestamp: Date; read?: boolean }[]
        }[] = []

        let currentGroup: (typeof groups)[0] | null = null

        messages.forEach((message) => {
            const messageDate = formatDate(new Date(message.timestamp))
            const sender = users.find((u) => u.id === message.sender.id) || message.sender

            // Start a new group if:
            // 1. No current group
            // 2. Different sender
            // 3. Different date
            // 4. More than 5 minutes since last message
            const shouldStartNewGroup =
                !currentGroup ||
                currentGroup.senderId !== message.sender.id ||
                currentGroup.date !== messageDate ||
                (currentGroup.messages.length > 0 &&
                    new Date(message.timestamp).getTime() -
                    new Date(currentGroup.messages[currentGroup.messages.length - 1].timestamp).getTime() >
                    5 * 60 * 1000)

            if (shouldStartNewGroup) {
                currentGroup = {
                    senderId: message.sender.id,
                    senderName: message.sender.username,
                    senderAvatar: message.sender.avatar,
                    senderStatus: "status" in sender ? (sender.status as "online" | "away" | "offline") : undefined,
                    date: messageDate,
                    messages: [],
                }
                groups.push(currentGroup)
            }

            if (currentGroup) {
                currentGroup.messages.push({
                    id: message.id,
                    content: message.content,
                    timestamp: new Date(message.timestamp),
                    read: "read" in message ? message.read : false,
                })
            }
        })

        return groups
    }, [messages, users])

    // Count users who are typing
    const typingUsersCount = Object.values(typingUsers).filter(Boolean).length
    const typingUsersList = Object.entries(typingUsers)
        .filter(([, isTyping]) => isTyping)
        .map(([userId]) => users.find((user) => user.id === userId))
        .filter(Boolean) as User[]

    if (messages.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-center">No messages yet</p>
                <p className="text-center text-sm mt-2">Start the conversation by sending a message</p>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-4" ref={messagesContainerRef}>
            <div className="space-y-6">
                {groupedMessages.map((group, groupIndex) => (
                    <div key={`${group.senderId}-${groupIndex}`} className="space-y-2">
                        {/* Date separator if needed */}
                        {groupIndex === 0 || groupedMessages[groupIndex - 1].date !== group.date ? (
                            <div className="flex items-center my-4">
                                <Separator className="flex-grow" />
                                <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">{group.date}</span>
                                <Separator className="flex-grow" />
                            </div>
                        ) : null}

                        <div className={cn("flex", group.senderId === currentUser?.id ? "justify-end" : "")}>
                            {group.senderId !== currentUser?.id && (
                                <div className="mr-4 mt-0.5">
                                    <UserAvatar src={group.senderAvatar} username={group.senderName} status={group.senderStatus} />
                                </div>
                            )}

                            <div className={cn("max-w-[70%]", group.senderId === currentUser?.id ? "text-right" : "")}>
                                <div className="flex items-baseline">
                                    {group.senderId !== currentUser?.id && (
                                        <span className="font-medium text-sm mr-2">{group.senderName}</span>
                                    )}
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatTime(group.messages[0].timestamp)}
                                    </span>
                                </div>

                                <div className="space-y-1 mt-1">
                                    {group.messages.map((message) => (
                                        <div
                                            key={message.id}
                                            className={cn(
                                                "px-3 py-2 rounded-lg text-sm",
                                                group.senderId === currentUser?.id
                                                    ? "bg-blue-500 text-white ml-auto"
                                                    : "bg-gray-200 dark:bg-gray-700",
                                            )}
                                        >
                                            {message.content}
                                            {group.senderId === currentUser?.id && message.read && (
                                                <span className="text-xs text-blue-200 block text-right mt-1">Read</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {group.senderId === currentUser?.id && (
                                <div className="ml-4 mt-0.5">
                                    <UserAvatar src={group.senderAvatar} username={group.senderName} />
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Typing indicators */}
                {typingUsersCount > 0 && (
                    <div className="flex items-center space-x-2 text-sm bg-gray-50 dark:bg-gray-800/50 p-2 rounded-md text-gray-600 dark:text-gray-300 mt-2">
                        {typingUsersCount === 1 ? (
                            <TypingIndicator user={typingUsersList[0]} isTyping={true} />
                        ) : (
                            <div className="flex items-center gap-2">
                                <span>{typingUsersCount} people are typing</span>
                                <span className="flex">
                                    <span className="animate-bounce mx-0.5">.</span>
                                    <span className="animate-bounce animation-delay-200 mx-0.5">.</span>
                                    <span className="animate-bounce animation-delay-400 mx-0.5">.</span>
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Self typing indicator (visual feedback) */}
                {isTyping && <div className="text-xs text-gray-400 italic mt-1 text-right">You are typing...</div>}

                <div ref={messagesEndRef} />
            </div>
        </div>
    )
}
