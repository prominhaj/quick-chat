/* eslint-disable react-hooks/exhaustive-deps */
"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { getSocket } from "@/lib/socket"
import type { Message, ChatChannel, User } from "@/lib/types"
import { toast } from "sonner"

export function useMessages(currentUser: User | null, currentChannel: ChatChannel | null) {
    const [messages, setMessages] = useState<Message[]>([])
    const [directMessages, setDirectMessages] = useState<Record<string, Message[]>>({})
    const [isSending, setIsSending] = useState(false)
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
    const [dmTypingUsers, setDmTypingUsers] = useState<Record<string, boolean>>({})
    const [isTyping, setIsTyping] = useState(false)
    const [unreadDMs, setUnreadDMs] = useState<Record<string, number>>({})

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    const socket = getSocket()

    // Handle message events
    useEffect(() => {
        function onRoomHistory(data: { room: string; messages: Message[] }) {
            if (currentChannel?.id === data.room && currentChannel.type === "room") {
                setMessages(data.messages)
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)
            }
        }

        function onDmHistory(data: { channelId: string; recipientId: string; messages: Message[] }) {
            setDirectMessages(prev => ({
                ...prev,
                [data.channelId]: data.messages
            }))

            if (currentChannel?.id === data.channelId && currentChannel.type === "direct") {
                setMessages(data.messages)
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)

                // Mark messages as read
                data.messages.forEach(msg => {
                    if (!msg.read && msg.sender.id !== currentUser?.id) {
                        socket.emit("mark_read", {
                            messageId: msg.id,
                            channelId: data.channelId,
                            isDirectMessage: true
                        })
                    }
                })

                // Clear unread count for this channel
                setUnreadDMs(prev => ({
                    ...prev,
                    [data.channelId]: 0
                }))
            }
        }

        function onMessage(message: Message) {
            // Convert timestamp string to Date if needed
            const processedMessage = {
                ...message,
                timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
            }

            if (currentChannel && currentChannel.id === message.room && currentChannel.type === "room") {
                setMessages((prev) => [...prev, processedMessage])

                // Clear typing indicator for this user
                if (typingUsers[message.sender.id]) {
                    setTypingUsers((prev) => ({
                        ...prev,
                        [message.sender.id]: false,
                    }))
                }

                // Scroll to bottom
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)
            }

            // Show notification if message is from someone else and not in view
            if (message.sender.id !== currentUser?.id &&
                (currentChannel?.id !== message.room || document.hidden)) {
                // Browser notification
                if (Notification.permission === "granted") {
                    new Notification(`${message.sender.username} in #${message.room}`, {
                        body: message.content,
                        icon: message.sender.avatar,
                    })
                }

                // Toast notification
                toast(`New message in #${message.room}`, {
                    description: `${message.sender.username}: ${message.content.substring(0, 50)}${message.content.length > 50 ? "..." : ""}`,
                })
            }
        }

        function onDirectMessage(message: Message) {
            // Convert timestamp string to Date if needed
            const processedMessage = {
                ...message,
                timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
            }

            // Store in direct messages
            setDirectMessages(prev => {
                const channelMessages = prev[message.channelId!] || []
                return {
                    ...prev,
                    [message.channelId!]: [...channelMessages, processedMessage]
                }
            })

            // If this is the current channel, add to messages
            if (currentChannel && currentChannel.id === message.channelId && currentChannel.type === "direct") {
                setMessages((prev) => [...prev, processedMessage])

                // Clear typing indicator
                if (message.sender.id !== currentUser?.id && dmTypingUsers[message.sender.id]) {
                    setDmTypingUsers((prev) => ({
                        ...prev,
                        [message.sender.id]: false,
                    }))
                }

                // Mark as read if it's from the other person
                if (message.sender.id !== currentUser?.id) {
                    socket.emit("mark_read", {
                        messageId: message.id,
                        channelId: message.channelId,
                        isDirectMessage: true
                    })
                }

                // Scroll to bottom
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)
            } else if (message.sender.id !== currentUser?.id) {
                // Increment unread count for this channel
                setUnreadDMs(prev => ({
                    ...prev,
                    [message.channelId!]: (prev[message.channelId!] || 0) + 1
                }))
            }

            // Show notification if message is from someone else and not in view
            if (message.sender.id !== currentUser?.id &&
                (currentChannel?.id !== message.channelId || document.hidden)) {
                // Browser notification
                if (Notification.permission === "granted") {
                    new Notification(`Message from ${message.sender.username}`, {
                        body: message.content,
                        icon: message.sender.avatar,
                    })
                }

                // Toast notification
                toast(`New message from ${message.sender.username}`, {
                    description: message.content.substring(0, 50) + (message.content.length > 50 ? "..." : ""),
                })
            }
        }

        function onUserTyping(data: { room: string; userId: string; username: string; isTyping: boolean }) {
            if (currentChannel?.id === data.room && currentChannel.type === "room") {
                setTypingUsers((prev) => ({
                    ...prev,
                    [data.userId]: data.isTyping,
                }))
            }
        }

        function onUserDmTyping(data: { userId: string; username: string; isTyping: boolean }) {
            setDmTypingUsers((prev) => ({
                ...prev,
                [data.userId]: data.isTyping,
            }))
        }

        function onMessageRead(data: { messageId: string; channelId: string; readBy: string; isDirectMessage: boolean }) {
            if (data.isDirectMessage) {
                setDirectMessages(prev => {
                    const channelMessages = prev[data.channelId] || []
                    return {
                        ...prev,
                        [data.channelId]: channelMessages.map(msg =>
                            msg.id === data.messageId ? { ...msg, read: true } : msg
                        )
                    }
                })

                // Update current messages if this is the active channel
                if (currentChannel?.id === data.channelId && currentChannel.type === "direct") {
                    setMessages(prev =>
                        prev.map(msg =>
                            'channelId' in msg && msg.id === data.messageId ? { ...msg, read: true } : msg
                        )
                    )
                }
            } else {
                // Handle room message read status
                if (currentChannel?.id === data.channelId && currentChannel.type === "room") {
                    setMessages(prev =>
                        prev.map(msg => {
                            if ('room' in msg && msg.id === data.messageId) {
                                const readBy = msg.readBy || []
                                if (!readBy.includes(data.readBy)) {
                                    return { ...msg, readBy: [...readBy, data.readBy] }
                                }
                            }
                            return msg
                        })
                    )
                }
            }
        }

        socket.on("room_history", onRoomHistory)
        socket.on("dm_history", onDmHistory)
        socket.on("message", onMessage)
        socket.on("direct_message", onDirectMessage)
        socket.on("user_typing", onUserTyping)
        socket.on("user_dm_typing", onUserDmTyping)
        socket.on("message_read", onMessageRead)

        return () => {
            socket.off("room_history", onRoomHistory)
            socket.off("dm_history", onDmHistory)
            socket.off("message", onMessage)
            socket.off("direct_message", onDirectMessage)
            socket.off("user_typing", onUserTyping)
            socket.off("user_dm_typing", onUserDmTyping)
            socket.off("message_read", onMessageRead)
        }
    }, [socket, currentChannel, currentUser])

    // Send message
    const sendMessage = useCallback((content: string) => {
        if (!currentChannel || !content.trim()) return

        setIsSending(true)

        if (currentChannel.type === "room") {
            // Send room message
            socket.emit("message", {
                room: currentChannel.id,
                content,
                type: "text",
            })
        } else if (currentChannel.type === "direct" && currentChannel.recipientId) {
            // Send direct message
            socket.emit("direct_message", {
                recipientId: currentChannel.recipientId,
                content,
                type: "text",
            })
        }

        // Clear typing indicator
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null

            if (currentChannel.type === "room") {
                socket.emit("typing", { room: currentChannel.id, isTyping: false })
            } else if (currentChannel.type === "direct" && currentChannel.recipientId) {
                socket.emit("dm_typing", { recipientId: currentChannel.recipientId, isTyping: false })
            }

            setIsTyping(false)
        }

        // Simulate network delay for sending animation
        setTimeout(() => {
            setIsSending(false)
        }, 300)
    }, [currentChannel, socket])

    // Handle typing indicator
    const handleTyping = useCallback(() => {
        if (!currentChannel) return

        if (currentChannel.type === "room") {
            socket.emit("typing", { room: currentChannel.id, isTyping: true })
        } else if (currentChannel.type === "direct" && currentChannel.recipientId) {
            socket.emit("dm_typing", { recipientId: currentChannel.recipientId, isTyping: true })
        }

        setIsTyping(true)

        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        typingTimeoutRef.current = setTimeout(() => {
            if (currentChannel.type === "room") {
                socket.emit("typing", { room: currentChannel.id, isTyping: false })
            } else if (currentChannel.type === "direct" && currentChannel.recipientId) {
                socket.emit("dm_typing", { recipientId: currentChannel.recipientId, isTyping: false })
            }

            setIsTyping(false)
            typingTimeoutRef.current = null
        }, 2000)
    }, [currentChannel, socket])

    // Join room
    const joinRoom = useCallback((roomName: string) => {
        socket.emit("join_room", roomName)
    }, [socket])

    // Leave room
    const leaveRoom = useCallback((roomName: string) => {
        socket.emit("leave_room", roomName)
    }, [socket])

    // Get direct message history
    const getDmHistory = useCallback((recipientId: string) => {
        socket.emit("get_dm_history", recipientId)
    }, [socket])

    // Mark message as read
    const markAsRead = useCallback((messageId: string, channelId: string, isDirectMessage: boolean) => {
        socket.emit("mark_read", { messageId, channelId, isDirectMessage })
    }, [socket])

    return {
        messages,
        directMessages,
        isSending,
        typingUsers,
        dmTypingUsers,
        isTyping,
        unreadDMs,
        messagesEndRef,
        sendMessage,
        handleTyping,
        joinRoom,
        leaveRoom,
        getDmHistory,
        markAsRead,
        setUnreadDMs
    }
}
