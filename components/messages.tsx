/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
"use client"

import { getSocket, type User, type Message } from "@/lib/socket"
import type React from "react"
import { useEffect, useMemo, useState, useRef } from "react"
import { Send, Loader2, Hash, Menu, MessageSquare, PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ChatApp() {
    const [currentUser, setCurrentUser] = useState<User | null>(null)
    const [users, setUsers] = useState<User[]>([])
    const [rooms, setRooms] = useState<string[]>([])
    const [currentRoom, setCurrentRoom] = useState<string>("general")
    const [messages, setMessages] = useState<Message[]>([])
    const [isConnected, setIsConnected] = useState(false)
    const [isSending, setIsSending] = useState(false)
    const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
    const [newRoomName, setNewRoomName] = useState("")
    const [username, setUsername] = useState("")
    const [isRegistered, setIsRegistered] = useState(false)

    const messagesEndRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isMobile = useMediaQuery("(max-width: 768px)")

    const socket = useMemo(() => {
        const socket = getSocket()
        return socket
    }, [])

    // Handle connection and registration
    useEffect(() => {
        function onConnect() {
            setIsConnected(true)

            // Check if we have stored user data
            const storedUser = localStorage.getItem("chat_user")
            if (storedUser) {
                try {
                    const userData = JSON.parse(storedUser)
                    socket.emit("register", userData)
                } catch (e) {
                    console.error("Failed to parse stored user data", e)
                }
            }
        }

        function onDisconnect() {
            setIsConnected(false)
            toast.warning("Disconnected", {
                description: "Lost connection to the server. Trying to reconnect..."
            })
        }

        function onRegistered(user: User) {
            setCurrentUser(user)
            setIsRegistered(true)
            localStorage.setItem(
                "chat_user",
                JSON.stringify({
                    username: user.username,
                    avatar: user.avatar,
                }),
            )
        }

        function onRooms(availableRooms: string[]) {
            setRooms(availableRooms)
        }

        function onActiveUsers(activeUsers: User[]) {
            setUsers(activeUsers)
        }

        function onRoomHistory(data: { room: string; messages: Message[] }) {
            if (data.room === currentRoom) {
                setMessages(data.messages)
                setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
                }, 100)
            }
        }

        function onUserConnected(user: User) {
            setUsers((prev) => [...prev.filter((u) => u.id !== user.id), user])
            toast.success("User connected", {
                description: `${user.username} has joined the chat`,
            })
        }

        function onUserDisconnected(data: { userId: string; username: string }) {
            setUsers((prev) =>
                prev.map((user) => (user.id === data.userId ? { ...user, status: "offline", lastSeen: new Date() } : user)),
            )
        }

        function onUserStatus(data: { userId: string; status: "online" | "away" | "offline"; lastSeen: Date }) {
            setUsers((prev) =>
                prev.map((user) =>
                    user.id === data.userId ? { ...user, status: data.status, lastSeen: data.lastSeen } : user,
                ),
            )
        }

        function onUserTyping(data: { room: string; userId: string; username: string; isTyping: boolean }) {
            if (data.room === currentRoom) {
                setTypingUsers((prev) => ({
                    ...prev,
                    [data.userId]: data.isTyping,
                }))
            }
        }

        function onMessage(message: Message) {
            // Convert timestamp string to Date if needed
            const processedMessage = {
                ...message,
                timestamp: message.timestamp instanceof Date ? message.timestamp : new Date(message.timestamp),
            }

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

        function onError(error: { message: string }) {
            toast.error("Error", {
                description: error.message,
            })
        }

        socket.on("connect", onConnect)
        socket.on("disconnect", onDisconnect)
        socket.on("registered", onRegistered)
        socket.on("rooms", onRooms)
        socket.on("active_users", onActiveUsers)
        socket.on("room_history", onRoomHistory)
        socket.on("user_connected", onUserConnected)
        socket.on("user_disconnected", onUserDisconnected)
        socket.on("user_status", onUserStatus)
        socket.on("user_typing", onUserTyping)
        socket.on("message", onMessage)
        socket.on("error", onError)

        // Connect if not already connected
        if (!socket.connected) {
            socket.connect()
        }

        return () => {
            socket.off("connect", onConnect)
            socket.off("disconnect", onDisconnect)
            socket.off("registered", onRegistered)
            socket.off("rooms", onRooms)
            socket.off("active_users", onActiveUsers)
            socket.off("room_history", onRoomHistory)
            socket.off("user_connected", onUserConnected)
            socket.off("user_disconnected", onUserDisconnected)
            socket.off("user_status", onUserStatus)
            socket.off("user_typing", onUserTyping)
            socket.off("message", onMessage)
            socket.off("error", onError)
        }
    }, [socket, currentRoom, toast, typingUsers])

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // Handle room change
    const changeRoom = (room: string) => {
        if (room === currentRoom) return

        // Leave current room
        socket.emit("leave_room", currentRoom)

        // Join new room
        socket.emit("join_room", room)
        setCurrentRoom(room)
        setMessages([])
    }

    // Handle message submission
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const form = e.currentTarget
        const formData = new FormData(form)
        const content = formData.get("message") as string

        if (!content.trim()) return

        setIsSending(true)

        // Send message to server
        socket.emit("message", {
            room: currentRoom,
            content,
            type: "text",
        })

        form.reset()
        inputRef.current?.focus()

        // Clear typing indicator
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = null
            socket.emit("typing", { room: currentRoom, isTyping: false })
        }

        // Simulate network delay for sending animation
        setTimeout(() => {
            setIsSending(false)
        }, 300)
    }

    // Handle typing indicator
    const handleTyping = () => {
        socket.emit("typing", { room: currentRoom, isTyping: true })

        // Clear previous timeout
        if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current)
        }

        // Set timeout to clear typing indicator
        typingTimeoutRef.current = setTimeout(() => {
            socket.emit("typing", { room: currentRoom, isTyping: false })
            typingTimeoutRef.current = null
        }, 2000)
    }

    // Create new room
    const createRoom = () => {
        if (!newRoomName.trim()) return

        // Join new room
        socket.emit("join_room", newRoomName)
        setNewRoomName("")

        // Update rooms list (server will broadcast this)
        setRooms((prev) => [...prev, newRoomName])

        // Switch to new room
        setCurrentRoom(newRoomName)
        setMessages([])

        toast.success("Room created", {
            description: `You've created and joined #${newRoomName}`,
        })
    }

    // Register user
    const registerUser = () => {
        if (!username.trim()) return

        socket.emit("register", { username })
    }

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
            date: string
            messages: { id: string; content: string; timestamp: Date }[]
        }[] = []

        let currentGroup: (typeof groups)[0] | null = null

        messages.forEach((message) => {
            const messageDate = formatDate(new Date(message.timestamp))

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
                })
            }
        })

        return groups
    }, [messages])

    // Show registration dialog if not registered
    if (!isRegistered) {
        return (
            <div className="flex flex-col h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
                <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold mb-6 text-center">Join the Chat</h1>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                placeholder="Enter your username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <Button className="w-full" onClick={registerUser} disabled={!username.trim() || !isConnected}>
                            {!isConnected ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                "Join Chat"
                            )}
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {/* Sidebar for desktop */}
            {!isMobile && (
                <div className="w-64 border-r dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col">
                    {/* User info */}
                    <div className="p-4 border-b dark:border-gray-800">
                        <div className="flex items-center space-x-2">
                            <Avatar>
                                <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                                <AvatarFallback>{currentUser?.username.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{currentUser?.username}</p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                            </div>
                        </div>
                    </div>

                    {/* Channels */}
                    <div className="p-4 border-b dark:border-gray-800">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Channels</h3>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-5 w-5">
                                        <PlusCircle className="h-4 w-4" />
                                        <span className="sr-only">Add Channel</span>
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Create a new channel</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="room-name">Channel name</Label>
                                            <Input
                                                id="room-name"
                                                placeholder="e.g. general"
                                                value={newRoomName}
                                                onChange={(e) => setNewRoomName(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button onClick={createRoom} disabled={!newRoomName.trim()}>
                                            Create Channel
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <ScrollArea className="h-40">
                            <div className="space-y-1">
                                {rooms.map((room) => (
                                    <Button
                                        key={room}
                                        variant={currentRoom === room ? "secondary" : "ghost"}
                                        className={cn("w-full justify-start", currentRoom === room ? "bg-gray-100 dark:bg-gray-800" : "")}
                                        onClick={() => changeRoom(room)}
                                    >
                                        <Hash className="mr-2 h-4 w-4" />
                                        {room}
                                    </Button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Online users */}
                    <div className="p-4 flex-1 overflow-hidden">
                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Online Users</h3>
                        <ScrollArea className="h-full">
                            <div className="space-y-2">
                                {users
                                    .filter((user) => user.status === "online")
                                    .map((user) => (
                                        <div key={user.id} className="flex items-center space-x-2">
                                            <div className="relative">
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={user.avatar || "/placeholder.svg"} />
                                                    <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-1 ring-white dark:ring-gray-950" />
                                            </div>
                                            <span className="text-sm truncate">{user.username}</span>
                                        </div>
                                    ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 flex flex-col">
                {/* Header */}
                <header className="border-b dark:border-gray-800 bg-white dark:bg-gray-950 p-4 shadow-sm">
                    <div className="flex items-center">
                        {isMobile && (
                            <Sheet>
                                <SheetTrigger asChild>
                                    <Button variant="ghost" size="icon" className="mr-2">
                                        <Menu className="h-5 w-5" />
                                        <span className="sr-only">Menu</span>
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="left" className="w-[300px] sm:w-[400px]">
                                    {/* User info */}
                                    <div className="py-4 border-b dark:border-gray-800">
                                        <div className="flex items-center space-x-2">
                                            <Avatar>
                                                <AvatarImage src={currentUser?.avatar || "/placeholder.svg"} />
                                                <AvatarFallback>{currentUser?.username.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium truncate">{currentUser?.username}</p>
                                                <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Channels */}
                                    <div className="py-4 border-b dark:border-gray-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Channels</h3>
                                            <Dialog>
                                                <DialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-5 w-5">
                                                        <PlusCircle className="h-4 w-4" />
                                                        <span className="sr-only">Add Channel</span>
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent>
                                                    <DialogHeader>
                                                        <DialogTitle>Create a new channel</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="space-y-4 py-4">
                                                        <div className="space-y-2">
                                                            <Label htmlFor="room-name-mobile">Channel name</Label>
                                                            <Input
                                                                id="room-name-mobile"
                                                                placeholder="e.g. general"
                                                                value={newRoomName}
                                                                onChange={(e) => setNewRoomName(e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                    <DialogFooter>
                                                        <Button onClick={createRoom} disabled={!newRoomName.trim()}>
                                                            Create Channel
                                                        </Button>
                                                    </DialogFooter>
                                                </DialogContent>
                                            </Dialog>
                                        </div>

                                        <div className="space-y-1">
                                            {rooms.map((room) => (
                                                <Button
                                                    key={room}
                                                    variant={currentRoom === room ? "secondary" : "ghost"}
                                                    className={cn(
                                                        "w-full justify-start",
                                                        currentRoom === room ? "bg-gray-100 dark:bg-gray-800" : "",
                                                    )}
                                                    onClick={() => {
                                                        // changeRoom(room)
                                                        (document.querySelector("[data-radix-sheet-close]") as HTMLElement)?.click()
                                                    }}
                                                >
                                                    <Hash className="mr-2 h-4 w-4" />
                                                    {room}
                                                </Button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Online users */}
                                    <div className="py-4">
                                        <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Online Users</h3>
                                        <div className="space-y-2">
                                            {users
                                                .filter((user) => user.status === "online")
                                                .map((user) => (
                                                    <div key={user.id} className="flex items-center space-x-2">
                                                        <div className="relative">
                                                            <Avatar className="h-8 w-8">
                                                                <AvatarImage src={user.avatar || "/placeholder.svg"} />
                                                                <AvatarFallback>{user.username.charAt(0)}</AvatarFallback>
                                                            </Avatar>
                                                            <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-1 ring-white dark:ring-gray-950" />
                                                        </div>
                                                        <span className="text-sm truncate">{user.username}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                </SheetContent>
                            </Sheet>
                        )}

                        <div className="flex items-center">
                            <Hash className="h-5 w-5 mr-2" />
                            <h1 className="text-lg font-semibold">{currentRoom}</h1>
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <span
                                className={cn("inline-block w-2 h-2 rounded-full", isConnected ? "bg-green-500" : "bg-red-500")}
                            ></span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                                {isConnected ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Messages Container */}
                <div className="flex-1 overflow-hidden p-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
                            <MessageSquare className="h-12 w-12 mb-4 opacity-20" />
                            <p className="text-center">No messages in #{currentRoom} yet</p>
                            <p className="text-center text-sm mt-2">Start the conversation by sending a message</p>
                        </div>
                    ) : (
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

                                    <div className="flex">
                                        <div className="mr-4 mt-0.5">
                                            <Avatar className="h-8 w-8">
                                                <AvatarImage src={group.senderAvatar || "/placeholder.svg"} />
                                                <AvatarFallback>{group.senderName.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-baseline">
                                                <span className="font-medium text-sm">{group.senderName}</span>
                                                <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                                    {formatTime(group.messages[0].timestamp)}
                                                </span>
                                            </div>
                                            <div className="space-y-1 mt-1">
                                                {group.messages.map((message) => (
                                                    <div key={message.id} className="text-sm">
                                                        {message.content}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Typing indicators */}
                            {Object.entries(typingUsers)
                                .filter(([_, isTyping]) => isTyping)
                                .map(([userId]) => {
                                    const typingUser = users.find((user) => user.id === userId)
                                    return typingUser ? (
                                        <div
                                            key={`typing-${userId}`}
                                            className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400"
                                        >
                                            <Avatar className="h-6 w-6">
                                                <AvatarImage src={typingUser.avatar || "/placeholder.svg"} />
                                                <AvatarFallback>{typingUser.username.charAt(0)}</AvatarFallback>
                                            </Avatar>
                                            <span>{typingUser.username} is typing...</span>
                                            <span className="flex">
                                                <span className="animate-bounce mx-0.5">.</span>
                                                <span className="animate-bounce animation-delay-200 mx-0.5">.</span>
                                                <span className="animate-bounce animation-delay-400 mx-0.5">.</span>
                                            </span>
                                        </div>
                                    ) : null
                                })}

                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>

                {/* Message Input */}
                <div className="border-t dark:border-gray-800 bg-white dark:bg-gray-950 p-4">
                    <form className="flex items-center gap-2" onSubmit={handleSubmit}>
                        <Input
                            ref={inputRef}
                            className="flex-1"
                            placeholder={`Message #${currentRoom}`}
                            name="message"
                            autoComplete="off"
                            disabled={!isConnected || isSending}
                            onChange={handleTyping}
                        />
                        <Button type="submit" disabled={!isConnected || isSending} size="icon">
                            {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                            <span className="sr-only">Send message</span>
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
