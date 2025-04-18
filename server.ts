import { createServer } from "node:http"
import next from "next"
import { Server } from "socket.io"
import { randomUUID } from "node:crypto"

// In-memory storage (replace with a database in production)
const users = new Map() // Map of socket ID to user
const usersByUserId = new Map() // Map of user ID to user (for reconnection)
const rooms = new Map()
const directMessages = new Map() // Store direct messages between users

    // Initialize rooms
    ;["general", "random", "support"].forEach((room) => {
        rooms.set(room, { name: room, messages: [] })
    })

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = Number.parseInt(process.env.PORT || "3000", 10)
const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

// Helper function to get direct message channel ID
const getDirectChannelId = (userId1: string, userId2: string) => {
    return [userId1, userId2].sort().join("_")
}

app.prepare().then(() => {
    const httpServer = createServer(handler)

    // Configure Socket.IO with CORS for development
    const io = new Server(httpServer, {
        cors: {
            origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : "*",
            methods: ["GET", "POST"],
            credentials: true,
        },
    })

    // Middleware to log connections
    io.use((socket, next) => {
        console.log(`New connection: ${socket.id}`)
        next()
    })

    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`)

        // Modify the register event handler to better handle reconnections
        socket.on("register", ({ username, avatar, userId }) => {
            console.log(`Register attempt: ${username}, userId: ${userId || "new user"}`)

            // If userId is provided, check if this is a reconnection
            if (userId) {
                // Look for an existing user with this ID
                const existingUser = usersByUserId.get(userId)

                if (existingUser) {
                    console.log(`Reconnecting existing user: ${existingUser.username} (${userId})`)

                    // Update the socket ID for the existing user
                    existingUser.socketId = socket.id
                    existingUser.status = "online"
                    existingUser.lastSeen = new Date()

                    // Store the user with the new socket ID
                    users.set(socket.id, existingUser)
                    usersByUserId.set(userId, existingUser)

                    // Join all the user's previous rooms
                    if (existingUser.rooms) {
                        existingUser.rooms.forEach((room: string) => {
                            socket.join(room)
                        })
                    }

                    // Send user their info
                    socket.emit("registered", existingUser)

                    // Send available rooms
                    socket.emit("rooms", Array.from(rooms.keys()))

                    // Notify others about user reconnection
                    socket.broadcast.emit("user_connected", {
                        id: existingUser.id,
                        username: existingUser.username,
                        avatar: existingUser.avatar,
                        status: existingUser.status,
                    })

                    // Send active users list
                    const activeUsers = Array.from(usersByUserId.values())
                    socket.emit("active_users", activeUsers)

                    // Send recent messages for default room
                    const roomMessages = rooms.get("general")?.messages || []
                    socket.emit("room_history", {
                        room: "general",
                        messages: roomMessages.slice(-50), // Last 50 messages
                    })

                    console.log(`User reconnected: ${existingUser.username} (${existingUser.id})`)
                    return
                } else {
                    console.log(`User ID ${userId} provided but not found in server memory`)
                }
            }

            // Check for duplicate username
            const isDuplicate = Array.from(usersByUserId.values()).some(
                (user) => user.username.toLowerCase() === username.toLowerCase() && user.status === "online",
            )

            if (isDuplicate) {
                console.log(`Username ${username} is already taken`)
                socket.emit("registration_error", { message: "Username already taken. Please choose another one." })
                return
            }

            const newUserId = userId || randomUUID()
            console.log(`Creating new user: ${username} (${newUserId})`)

            const user = {
                id: newUserId,
                socketId: socket.id,
                username: username || `User-${newUserId.substring(0, 6)}`,
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${newUserId}`,
                status: "online",
                lastSeen: new Date(),
                rooms: ["general"], // Default room
                directMessages: [], // Track direct message channels
            }

            users.set(socket.id, user)
            usersByUserId.set(newUserId, user)

            // Join the default room
            socket.join("general")

            // Send user their info
            socket.emit("registered", user)

            // Send available rooms
            socket.emit("rooms", Array.from(rooms.keys()))

            // Notify others about new user
            socket.broadcast.emit("user_connected", {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                status: user.status,
            })

            // Send active users list
            const activeUsers = Array.from(usersByUserId.values())
            socket.emit("active_users", activeUsers)

            // Send recent messages for default room
            const roomMessages = rooms.get("general")?.messages || []
            socket.emit("room_history", {
                room: "general",
                messages: roomMessages.slice(-50), // Last 50 messages
            })
        })

        // Handle joining rooms
        socket.on("join_room", (roomName) => {
            const user = users.get(socket.id)
            if (!user) return

            // Create room if it doesn't exist
            if (!rooms.has(roomName)) {
                rooms.set(roomName, { name: roomName, messages: [] })
            }

            // Join the room
            socket.join(roomName)

            // Update user's rooms
            if (!user.rooms.includes(roomName)) {
                user.rooms.push(roomName)
            }

            // Send room history
            const roomMessages = rooms.get(roomName)?.messages || []
            socket.emit("room_history", {
                room: roomName,
                messages: roomMessages.slice(-50), // Last 50 messages
            })

            // Notify room about new user
            socket.to(roomName).emit("user_joined", {
                room: roomName,
                userId: user.id,
                username: user.username,
            })

            console.log(`${user.username} joined room: ${roomName}`)
        })

        // Handle leaving rooms
        socket.on("leave_room", (roomName) => {
            const user = users.get(socket.id)
            if (!user) return

            socket.leave(roomName)
            user.rooms = user.rooms.filter((r: string) => r !== roomName)

            // Notify room
            socket.to(roomName).emit("user_left", {
                room: roomName,
                userId: user.id,
                username: user.username,
            })

            console.log(`${user.username} left room: ${roomName}`)
        })

        // Handle messages
        socket.on("message", ({ room, content, type = "text" }) => {
            const user = users.get(socket.id)
            if (!user || !room || !content) return

            // Check if user is in the room
            if (!user.rooms.includes(room)) {
                socket.emit("error", { message: "You're not in this room" })
                return
            }

            const message = {
                id: randomUUID(),
                room,
                content,
                type,
                sender: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                },
                timestamp: new Date(),
                read: false,
                readBy: [user.id], // Mark as read by sender
            }

            // Store message
            if (rooms.has(room)) {
                const roomData = rooms.get(room)
                roomData.messages.push(message)
                // Limit stored messages (in a real app, use a database)
                if (roomData.messages.length > 100) {
                    roomData.messages.shift()
                }
            }

            // Broadcast to room
            io.to(room).emit("message", message)
            console.log(`Message in ${room} from ${user.username}: ${content.substring(0, 50)}`)
        })

        // Handle direct messages
        socket.on("direct_message", ({ recipientId, content, type = "text" }) => {
            const sender = users.get(socket.id)
            if (!sender || !recipientId || !content) return

            // Find recipient
            const recipient = Array.from(users.values()).find((u) => u.id === recipientId)
            if (!recipient) {
                socket.emit("error", { message: "User not found" })
                return
            }

            // Create direct message channel ID
            const channelId = getDirectChannelId(sender.id, recipientId)

            // Create message object
            const message = {
                id: randomUUID(),
                channelId,
                content,
                type,
                sender: {
                    id: sender.id,
                    username: sender.username,
                    avatar: sender.avatar,
                },
                recipient: {
                    id: recipient.id,
                    username: recipient.username,
                    avatar: recipient.avatar,
                },
                timestamp: new Date(),
                read: false,
            }

            // Store message
            if (!directMessages.has(channelId)) {
                directMessages.set(channelId, [])
            }
            directMessages.get(channelId).push(message)

            // Limit stored messages
            if (directMessages.get(channelId).length > 100) {
                directMessages.get(channelId).shift()
            }

            // Add channel to users' direct messages list if not already there
            if (!sender.directMessages.includes(channelId)) {
                sender.directMessages.push(channelId)
            }
            if (!recipient.directMessages.includes(channelId)) {
                recipient.directMessages.push(channelId)
            }

            // Send to sender
            socket.emit("direct_message", message)

            // Send to recipient if online
            if (recipient.socketId) {
                io.to(recipient.socketId).emit("direct_message", message)

                // Send notification to recipient
                io.to(recipient.socketId).emit("dm_notification", {
                    senderId: sender.id,
                    senderName: sender.username,
                    message: content.substring(0, 50) + (content.length > 50 ? "..." : ""),
                })
            }

            console.log(`DM from ${sender.username} to ${recipient.username}: ${content.substring(0, 50)}`)
        })

        // Handle direct message history request
        socket.on("get_dm_history", (recipientId) => {
            const user = users.get(socket.id)
            if (!user || !recipientId) return

            const channelId = getDirectChannelId(user.id, recipientId)
            const messages = directMessages.get(channelId) || []

            socket.emit("dm_history", {
                channelId,
                recipientId,
                messages: messages.slice(-50), // Last 50 messages
            })
        })

        // Handle message read status
        socket.on("mark_read", ({ messageId, channelId, isDirectMessage = false }) => {
            const user = users.get(socket.id)
            if (!user) return

            if (isDirectMessage) {
                const messages = directMessages.get(channelId)
                if (messages) {
                    const message = messages.find((m: {id: string}) => m.id === messageId)
                    if (message) {
                        message.read = true

                        // Notify the sender that the message was read
                        const senderId = message.sender.id
                        const senderSocket = Array.from(users.values()).find((u) => u.id === senderId)?.socketId

                        if (senderSocket) {
                            io.to(senderSocket).emit("message_read", {
                                messageId,
                                channelId,
                                readBy: user.id,
                                isDirectMessage: true,
                            })
                        }
                    }
                }
            } else {
                const roomMessages = rooms.get(channelId)?.messages
                if (roomMessages) {
                    const message = roomMessages.find((m: { id: string }) => m.id === messageId)
                    if (message) {
                        if (!message.readBy) message.readBy = []
                        if (!message.readBy.includes(user.id)) {
                            message.readBy.push(user.id)

                            // Notify others that the message was read
                            socket.to(channelId).emit("message_read", {
                                messageId,
                                channelId,
                                readBy: user.id,
                                isDirectMessage: false,
                            })
                        }
                    }
                }
            }
        })

        // Handle typing indicators
        socket.on("typing", ({ room, isTyping }) => {
            const user = users.get(socket.id)
            if (!user || !room) return

            socket.to(room).emit("user_typing", {
                room,
                userId: user.id,
                username: user.username,
                isTyping,
            })
        })

        // Handle direct message typing indicators
        socket.on("dm_typing", ({ recipientId, isTyping }) => {
            const user = users.get(socket.id)
            if (!user || !recipientId) return

            // Find recipient socket
            const recipient = Array.from(users.values()).find((u) => u.id === recipientId)
            if (recipient && recipient.socketId) {
                io.to(recipient.socketId).emit("user_dm_typing", {
                    userId: user.id,
                    username: user.username,
                    isTyping,
                })
            }
        })

        // Handle status updates
        socket.on("status", (status) => {
            const user = users.get(socket.id)
            if (!user) return

            user.status = status
            user.lastSeen = new Date()

            // Broadcast to all users
            socket.broadcast.emit("user_status", {
                userId: user.id,
                status,
                lastSeen: user.lastSeen,
            })
        })

        // Handle disconnection
        socket.on("disconnect", () => {
            const user = users.get(socket.id)
            if (user) {
                // Update user status
                user.status = "offline"
                user.lastSeen = new Date()

                // Notify all users
                socket.broadcast.emit("user_disconnected", {
                    userId: user.id,
                    username: user.username,
                    lastSeen: user.lastSeen,
                })

                // Remove user after a delay (to allow reconnection)
                setTimeout(() => {
                    // Check if user reconnected with a different socket
                    const currentUser = usersByUserId.get(user.id)
                    if (currentUser && currentUser.status === "offline") {
                        users.delete(socket.id)
                        usersByUserId.delete(user.id)
                        console.log(`User removed: ${user.username} (${user.id})`)
                    }
                }, 60000) // 1 minute delay
            }

            console.log(`Client disconnected: ${socket.id}`)
        })
    })

    httpServer
        .once("error", (err) => {
            console.error(err)
            process.exit(1)
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`)
            console.log(`> Socket.IO server running`)
        })
})

// Log active connections every 5 minutes
setInterval(() => {
    console.log(`Registered users: ${users.size}`)
    console.log(`Active DM channels: ${directMessages.size}`)
}, 300000)

// Update the active_users event to send users from usersByUserId
// function onActiveUsers() {
//     // 'socket' is not defined in this scope. It should be accessed through the 'io.on("connection", (socket) => {' callback
//     // The following line is commented out because 'socket' is not defined here.
//     // socket.emit("active_users", activeUsers)
// }
