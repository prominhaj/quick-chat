import { io, type Socket } from "socket.io-client"

let socket: Socket | null = null

export type DirectMessage = {
    id: string
    channelId: string
    content: string
    type: "text" | "image" | "file"
    sender: {
        id: string
        username: string
        avatar: string
    }
    recipient: {
        id: string
        username: string
        avatar: string
    }
    timestamp: Date
    read: boolean
}

export const getSocket = () => {
    if (!socket) {
        // Use environment variable or default to current host
        const host = process.env.NEXT_PUBLIC_SOCKET_URL || window.location.origin

        console.log("Connecting to socket server:", host)

        socket = io(host, {
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
            timeout: 20000,
            transports: ["websocket", "polling"],
            autoConnect: true,
            reconnection: true,
        })

        // Add global error handler
        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err.message)
        })

        socket.on("connect", () => {
            console.log("Socket connected with ID:", socket?.id)
        })

        socket.on("disconnect", (reason) => {
            console.log("Socket disconnected:", reason)
        })
    }
    return socket
}

// Helper function to get direct message channel ID
export const getDirectChannelId = (userId1: string, userId2: string) => {
    return [userId1, userId2].sort().join("_")
}
