"use client"

import { useState, useEffect, useCallback } from "react"
import { getSocket } from "@/lib/socket"
import { toast } from "sonner"
import type { User, ChatChannel } from "@/lib/types"

export function useChat() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [rooms, setRooms] = useState<string[]>([])
    const [channels, setChannels] = useState<ChatChannel[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [isRegistered, setIsRegistered] = useState(false)
    const [onlineCount, setOnlineCount] = useState(0)
    const [registrationError, setRegistrationError] = useState<string | null>(null)

    const socket = getSocket()

    // Update the registerUser function to better handle stored user data
    const registerUser = useCallback(
        (username: string, avatar?: string) => {
            if (!username.trim()) return
            setRegistrationError(null)

            // Check if we have a stored user ID
            const storedUser = localStorage.getItem("chat_user")
            let userId = null

            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser)
                    userId = userData.id
                    console.log("Found stored user ID:", userId)
                } catch (e) {
                    console.error("Failed to parse stored user data", e)
                }
            }

            console.log("Registering with:", { username, avatar, userId })
            socket.emit("register", { username, avatar, userId })
        },
        [socket],
    )

    // Handle connection and registration
    useEffect(() => {
        // Update the onConnect function to better handle reconnection
        function onConnect() {
            setIsConnected(true)
            toast.success("Connected to server")

            // Check if we have stored user data
            const storedUser = localStorage.getItem("chat_user")
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser)
                    console.log("Reconnecting with stored user data:", userData)

                    if (userData.id) {
                        socket.emit("register", {
                            username: userData.username,
                            avatar: userData.avatar,
                            userId: userData.id, // Send the user ID for reconnection
                        })
                    }
                } catch (e) {
                    console.error("Failed to parse stored user data", e)
                }
            }
        }

        function onDisconnect() {
            setIsConnected(false)
            toast.warning("Disconnected", {
                description: "Lost connection to the server. Trying to reconnect...",
            })
        }

        function onConnectError(err: Error) {
            console.error("Connection error:", err)
            setIsConnected(false)
            toast.error(`Connection error: ${err.message}`)
        }

        // Update the onRegistered function to ensure user ID is stored
        function onRegistered(user: User) {
            console.log("Registered as:", user)
            setCurrentUser(user)
            setIsRegistered(true)

            // Store complete user data including ID
            localStorage.setItem(
                "chat_user",
                JSON.stringify({
                    username: user.username,
                    avatar: user.avatar,
                    id: user.id,
                }),
            )

            toast.success(`Welcome, ${user.username}!`)
            setRegistrationError(null)
        }

        function onRegistrationError(error: { message: string }) {
            setRegistrationError(error.message)
            toast.error("Registration failed", {
                description: error.message,
            })
        }

        function onRooms(availableRooms: string[]) {
            setRooms(availableRooms)
        }

        function onActiveUsers(activeUsers: User[]) {
            setUsers(activeUsers)
            setOnlineCount(activeUsers.filter((user) => user.status === "online").length)
        }

        function onUserConnected(user: User) {
            setUsers((prev) => {
                const updatedUsers = [...prev.filter((u) => u.id !== user.id), user]
                setOnlineCount(updatedUsers.filter((u) => u.status === "online").length)
                return updatedUsers
            })

            toast.success("User connected", {
                description: `${user.username} has joined the chat`,
            })
        }

        function onUserDisconnected(data: { userId: string; username: string }) {
            setUsers((prev) => {
                const updatedUsers = prev.map((user) =>
                    user.id === data.userId ? { ...user, status: "offline" as "online" | "away" | "offline", lastSeen: new Date() } : user,
                )
                setOnlineCount(updatedUsers.filter((u) => u.status === "online").length)
                return updatedUsers
            })

            toast.info(`${data.username} has disconnected`)
        }

        function onUserStatus(data: { userId: string; status: "online" | "away" | "offline"; lastSeen: Date }) {
            setUsers((prev) => {
                const updatedUsers = prev.map((user) =>
                    user.id === data.userId ? { ...user, status: data.status, lastSeen: data.lastSeen } : user,
                )
                setOnlineCount(updatedUsers.filter((u) => u.status === "online").length)
                return updatedUsers
            })
        }

        function onError(error: { message: string }) {
            toast.error("Error", {
                description: error.message,
            })
        }

        // Request notification permission
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
            Notification.requestPermission()
        }

        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("connect_error", onConnectError)
        socket.on("registered", onRegistered)
        socket.on("registration_error", onRegistrationError)
        socket.on("rooms", onRooms)
        socket.on("active_users", onActiveUsers)
        socket.on("user_connected", onUserConnected)
        socket.on("user_disconnected", onUserDisconnected)
        socket.on("user_status", onUserStatus)
        socket.on("error", onError)

        // Connect if not already connected
        if (!socket.connected) {
            socket.connect()
        }

        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            socket.off("connect_error", onConnectError)
            socket.off("registered", onRegistered)
            socket.off("registration_error", onRegistrationError)
            socket.off("rooms", onRooms)
            socket.off("active_users", onActiveUsers)
            socket.off("user_connected", onUserConnected)
            socket.off("user_disconnected", onUserDisconnected)
            socket.off("user_status", onUserStatus)
            socket.off("error", onError)
        }
    }, [socket])

    // Update user status
    const updateStatus = useCallback(
        (status: "online" | "away" | "offline") => {
            socket.emit("status", status)
        },
        [socket],
    )

    return {
        currentUser,
        users,
        rooms,
        channels,
        isConnected,
        isRegistered,
        onlineCount,
        registerUser,
        updateStatus,
        registrationError,
        setChannels,
        socket,
    }
}
