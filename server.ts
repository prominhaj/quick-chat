import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { randomUUID } from "node:crypto";

// In-memory storage (replace with a database in production)
const users = new Map();
const rooms = new Map();

// Initialize rooms
["general", "random", "support"].forEach(room => {
    rooms.set(room, { name: room, messages: [] });
});

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
    const httpServer = createServer(handler);

    // Configure Socket.IO with CORS for development
    const io = new Server(httpServer, {
        cors: {
            origin: dev ? ["http://localhost:3000"] : false,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    // Middleware to log connections
    io.use((socket, next) => {
        console.log(`New connection: ${socket.id}`);
        next();
    });

    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Handle user registration
        socket.on("register", ({ username, avatar }) => {
            const userId = randomUUID();
            const user = {
                id: userId,
                socketId: socket.id,
                username: username || `User-${userId.substring(0, 6)}`,
                avatar: avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userId}`,
                status: "online",
                lastSeen: new Date(),
                rooms: ["general"] // Default room
            };

            users.set(socket.id, user);

            // Join the default room
            socket.join("general");

            // Send user their info
            socket.emit("registered", user);

            // Send available rooms
            socket.emit("rooms", Array.from(rooms.keys()));

            // Notify others about new user
            socket.broadcast.emit("user_connected", {
                userId: user.id,
                username: user.username,
                avatar: user.avatar
            });

            // Send active users list
            socket.emit("active_users", Array.from(users.values()));

            // Send recent messages for default room
            const roomMessages = rooms.get("general")?.messages || [];
            socket.emit("room_history", {
                room: "general",
                messages: roomMessages.slice(-50) // Last 50 messages
            });
        });

        // Handle joining rooms
        socket.on("join_room", (roomName) => {
            const user = users.get(socket.id);
            if (!user) return;

            // Create room if it doesn't exist
            if (!rooms.has(roomName)) {
                rooms.set(roomName, { name: roomName, messages: [] });
            }

            // Join the room
            socket.join(roomName);

            // Update user's rooms
            if (!user.rooms.includes(roomName)) {
                user.rooms.push(roomName);
            }

            // Send room history
            const roomMessages = rooms.get(roomName)?.messages || [];
            socket.emit("room_history", {
                room: roomName,
                messages: roomMessages.slice(-50) // Last 50 messages
            });

            // Notify room about new user
            socket.to(roomName).emit("user_joined", {
                room: roomName,
                userId: user.id,
                username: user.username
            });

            console.log(`${user.username} joined room: ${roomName}`);
        });

        // Handle leaving rooms
        socket.on("leave_room", (roomName) => {
            const user = users.get(socket.id);
            if (!user) return;

            socket.leave(roomName);
            user.rooms = user.rooms.filter((r: string) => r !== roomName);

            // Notify room
            socket.to(roomName).emit("user_left", {
                room: roomName,
                userId: user.id,
                username: user.username
            });

            console.log(`${user.username} left room: ${roomName}`);
        });

        // Handle messages
        socket.on("message", ({ room, content, type = "text" }) => {
            const user = users.get(socket.id);
            if (!user || !room || !content) return;

            // Check if user is in the room
            if (!user.rooms.includes(room)) {
                socket.emit("error", { message: "You're not in this room" });
                return;
            }

            const message = {
                id: randomUUID(),
                room,
                content,
                type,
                sender: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar
                },
                timestamp: new Date()
            };

            // Store message
            if (rooms.has(room)) {
                const roomData = rooms.get(room);
                roomData.messages.push(message);
                // Limit stored messages (in a real app, use a database)
                if (roomData.messages.length > 100) {
                    roomData.messages.shift();
                }
            }

            // Broadcast to room
            io.to(room).emit("message", message);
            console.log(`Message in ${room} from ${user.username}: ${content.substring(0, 50)}`);
        });

        // Handle typing indicators
        socket.on("typing", ({ room, isTyping }) => {
            const user = users.get(socket.id);
            if (!user || !room) return;

            socket.to(room).emit("user_typing", {
                room,
                userId: user.id,
                username: user.username,
                isTyping
            });
        });

        // Handle status updates
        socket.on("status", (status) => {
            const user = users.get(socket.id);
            if (!user) return;

            user.status = status;
            user.lastSeen = new Date();

            // Broadcast to all users
            socket.broadcast.emit("user_status", {
                userId: user.id,
                status,
                lastSeen: user.lastSeen
            });
        });

        // Handle disconnection
        socket.on("disconnect", () => {
            const user = users.get(socket.id);
            if (user) {
                // Update user status
                user.status = "offline";
                user.lastSeen = new Date();

                // Notify all users
                socket.broadcast.emit("user_disconnected", {
                    userId: user.id,
                    username: user.username,
                    lastSeen: user.lastSeen
                });

                // Remove user after a delay (to allow reconnection)
                setTimeout(() => {
                    // Check if user reconnected with a different socket
                    const stillDisconnected = Array.from(users.values())
                        .filter(u => u.id === user.id)
                        .every(u => u.status === "offline");

                    if (stillDisconnected) {
                        users.delete(socket.id);
                        console.log(`User removed: ${user.username}`);
                    }
                }, 60000); // 1 minute delay
            }

            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    httpServer
        .once("error", (err) => {
            console.error(err);
            process.exit(1);
        })
        .listen(port, () => {
            console.log(`> Ready on http://${hostname}:${port}`);
            console.log(`> Socket.IO server running`);
        });
});

// Log active connections every 5 minutes
setInterval(() => {
    // console.log(`Active connections: ${io?.engine?.clientsCount || 0}`);
    console.log(`Registered users: ${users.size}`);
}, 300000);