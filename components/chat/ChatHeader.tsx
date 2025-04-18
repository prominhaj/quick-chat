"use client"

import { Button } from "@/components/ui/button"
import { Hash, Menu } from "lucide-react"
import { UserAvatar } from "@/components/chat/UserAvatar"
import { cn } from "@/lib/utils"
import type { ChatChannel } from "@/lib/types"

type ChatHeaderProps = {
    channel: ChatChannel | null
    isConnected: boolean
    onMenuClick?: () => void
    onBackClick?: () => void
    isMobile?: boolean
}

export function ChatHeader({ channel, isConnected, onMenuClick, onBackClick, isMobile }: ChatHeaderProps) {
    return (
        <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
            <div className="flex items-center">
                {isMobile && onMenuClick && (
                    <Button variant="ghost" size="icon" className="mr-2" onClick={onMenuClick}>
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Menu</span>
                    </Button>
                )}

                {isMobile && onBackClick && (
                    <Button variant="ghost" size="icon" className="mr-2" onClick={onBackClick}>
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Back</span>
                    </Button>
                )}

                {channel && (
                    <div className="flex items-center">
                        {channel.type === "room" ? (
                            <Hash className="h-5 w-5 mr-2" />
                        ) : (
                            <div className="mr-2">
                                <UserAvatar src={channel.avatar} username={channel.name} status={channel.status} />
                            </div>
                        )}
                        <div>
                            <h2 className="font-semibold">{channel.name}</h2>
                            {channel.type === "direct" && (
                                <p className="text-xs text-gray-500">{channel.status === "online" ? "Online" : "Offline"}</p>
                            )}
                        </div>
                    </div>
                )}

                <div className="ml-auto flex items-center gap-2">
                    <span className={cn("inline-block w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}></span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{isConnected ? "Connected" : "Disconnected"}</span>
                </div>
            </div>
        </header>
    )
}
