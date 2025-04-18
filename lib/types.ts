export type User = {
    id: string
    username: string
    avatar: string
    status: "online" | "away" | "offline"
    lastSeen?: Date
    socketId?: string
    rooms?: string[]
    directMessages?: string[]
}

export type Message = {
    id: string
    room?: string
    channelId?: string
    content: string
    type: "text" | "image" | "file"
    sender: {
        id: string
        username: string
        avatar: string
    }
    recipient?: {
        id: string
        username: string
        avatar: string
    }
    timestamp: Date
    read?: boolean
    readBy?: string[]
}

export type Room = {
    name: string
    messages: Message[]
}

export type DirectMessageChannel = {
    id: string
    participants: User[]
    messages: Message[]
    lastActivity: Date
}

export type DMNotification = {
    senderId: string
    senderName: string
    message: string
}

export type ChatChannel = {
    id: string
    name: string
    type: "room" | "direct"
    avatar?: string
    lastMessage?: string
    lastMessageTime?: Date
    unreadCount?: number
    recipientId?: string
    status?: "online" | "away" | "offline"
}
