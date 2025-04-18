"use client"

import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Hash } from "lucide-react"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/chat/UserAvatar"
import type { ChatChannel } from "@/lib/types"

type ChannelListProps = {
    channels: ChatChannel[]
    currentChannel: ChatChannel | null
    onSelectChannel: (channel: ChatChannel) => void
    onCreateChannel?: () => void
}

export function ChannelList({ channels, currentChannel, onSelectChannel, onCreateChannel }: ChannelListProps) {
    return (
        <ScrollArea className="flex-1">
            {onCreateChannel && (
                <div className="p-2">
                    <Button variant="outline" onClick={onCreateChannel}>
                        Create Channel
                    </Button>
                </div>
            )}
            <div className="space-y-1 p-2">
                {channels.map((channel) => (
                    <Button
                        key={channel.id}
                        variant={currentChannel?.id === channel.id ? "secondary" : "ghost"}
                        className={cn(
                            "w-full justify-start",
                            currentChannel?.id === channel.id ? "bg-gray-100 dark:bg-gray-800" : "",
                        )}
                        onClick={() => onSelectChannel(channel)}
                    >
                        {channel.type === "room" ? (
                            <Hash className="mr-2 h-4 w-4 shrink-0" />
                        ) : (
                            <div className="relative mr-2 shrink-0">
                                <UserAvatar src={channel.avatar} username={channel.name} status={channel.status} size="sm" />
                            </div>
                        )}
                        <span className="truncate">{channel.name}</span>
                        {channel.unreadCount ? (
                            <Badge variant="destructive" className="ml-auto">
                                {channel.unreadCount}
                            </Badge>
                        ) : null}
                    </Button>
                ))}
            </div>
        </ScrollArea>
    )
}
