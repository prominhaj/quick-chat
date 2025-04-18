"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/chat/UserAvatar"
import { cn } from "@/lib/utils"
import type { User } from "@/lib/types"

type UserListProps = {
    users: User[]
    selectedUserId?: string
    onSelectUser: (user: User) => void
    unreadCounts?: Record<string, number>
    currentUserId?: string
}

export function UserList({ users, selectedUserId, onSelectUser, unreadCounts = {}, currentUserId }: UserListProps) {
    // Filter out current user
    const filteredUsers = users.filter((user) => user.id !== currentUserId)

    return (
        <ScrollArea className="h-full">
            <div className="space-y-1 p-2">
                {filteredUsers.length === 0 ? (
                    <div className="text-center py-4 text-gray-500">
                        <p>No users available</p>
                    </div>
                ) : (
                    filteredUsers.map((user) => {
                        const channelId = [currentUserId, user.id].sort().join("_")
                        const unreadCount = unreadCounts[channelId] || 0

                        return (
                            <Button
                                key={user.id}
                                variant={selectedUserId === user.id ? "secondary" : "ghost"}
                                className={cn("w-full justify-start", selectedUserId === user.id ? "bg-gray-100 dark:bg-gray-800" : "")}
                                onClick={() => onSelectUser(user)}
                            >
                                <div className="flex items-center w-full">
                                    <div className="relative mr-2">
                                        <UserAvatar src={user.avatar} username={user.username} status={user.status} />
                                    </div>
                                    <div className="text-start min-w-0">
                                        <p className="text-sm font-medium truncate">{user.username}</p>
                                        <p className="text-xs text-gray-500 truncate">{user.status === "online" ? "Online" : "Offline"}</p>
                                    </div>
                                    {unreadCount > 0 && <Badge className="ml-auto bg-red-500">{unreadCount}</Badge>}
                                </div>
                            </Button>
                        )
                    })
                )}
            </div>
        </ScrollArea>
    )
}
