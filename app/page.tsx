"use client"

import { useState, useEffect, useMemo } from "react"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, Search, X } from "lucide-react"
import { getDirectChannelId } from "@/lib/socket"
import { useChat } from "@/hooks/useChat"
import { useMessages } from "@/hooks/useMessages"
import { LoginForm } from "@/components/chat/LoginForm"
import { ChatHeader } from "@/components/chat/ChatHeader"
import { ChannelList } from "@/components/chat/ChannelList"
import { UserList } from "@/components/chat/UserList"
import { MessageList } from "@/components/chat/MessageList"
import { MessageInput } from "@/components/chat/MessageInput"
import { UserAvatar } from "@/components/chat/UserAvatar"
import { Badge } from "@/components/ui/badge"
import type { ChatChannel, User } from "@/lib/types"

export default function ChatApp() {
  const {
    currentUser,
    users,
    rooms,
    isConnected,
    isRegistered,
    onlineCount,
    registerUser,
    registrationError,
    setChannels,
    channels,
  } = useChat()

  const [currentChannel, setCurrentChannel] = useState<ChatChannel | null>(null)
  const [newRoomName, setNewRoomName] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sheetOpen, setSheetOpen] = useState(false)

  const isMobile = useMediaQuery("(max-width: 768px)")

  const {
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
    setUnreadDMs,
  } = useMessages(currentUser, currentChannel)

  // Update channels when rooms, users, or direct messages change
  useEffect(() => {
    if (!currentUser) return

    const roomChannels = rooms.map((room) => ({
      id: room,
      name: room,
      type: "room" as const,
      avatar: undefined,
      lastMessage: undefined,
      unreadCount: 0,
    }))

    const dmChannels = users
      .filter((user) => user.id !== currentUser.id)
      .map((user) => {
        const channelId = getDirectChannelId(currentUser.id, user.id)
        const dmList = directMessages[channelId] || []
        const lastMessage = dmList.length > 0 ? dmList[dmList.length - 1] : undefined

        return {
          id: channelId,
          name: user.username,
          type: "direct" as const,
          avatar: user.avatar,
          lastMessage: lastMessage?.content,
          lastMessageTime: lastMessage?.timestamp,
          unreadCount: unreadDMs[channelId] || 0,
          recipientId: user.id,
          status: user.status,
        }
      })

    // Sort channels: rooms first, then DMs by last message time
    const sortedChannels = [
      ...roomChannels,
      ...dmChannels.sort((a, b) => {
        if (!a.lastMessageTime) return 1
        if (!b.lastMessageTime) return -1
        return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
      }),
    ]

    setChannels(sortedChannels)
  }, [rooms, users, directMessages, currentUser, unreadDMs, setChannels])

  // Set default channel to general when user registers
  useEffect(() => {
    if (currentUser && !currentChannel) {
      setCurrentChannel({
        id: "general",
        name: "general",
        type: "room",
      })
    }
  }, [currentUser, currentChannel])

  // Handle channel change
  const changeChannel = (channel: ChatChannel) => {
    if (channel.id === currentChannel?.id && channel.type === currentChannel?.type) return

    setCurrentChannel(channel)

    if (channel.type === "room") {
      // Leave current room if it's a room
      if (currentChannel?.type === "room") {
        leaveRoom(currentChannel.id)
      }

      // Join new room
      joinRoom(channel.id)
    } else if (channel.type === "direct" && channel.recipientId) {
      // Get direct message history
      getDmHistory(channel.recipientId)

      // Clear unread count
      setUnreadDMs((prev) => ({
        ...prev,
        [channel.id]: 0,
      }))
    }

    // Close mobile sidebar if open
    if (sheetOpen) {
      setSheetOpen(false)
    }
  }

  // Start a new direct message
  const startDirectMessage = (user: User) => {
    if (!currentUser) return

    const channelId = getDirectChannelId(currentUser.id, user.id)
    const channel: ChatChannel = {
      id: channelId,
      name: user.username,
      type: "direct",
      avatar: user.avatar,
      recipientId: user.id,
      status: user.status,
    }

    changeChannel(channel)
  }

  // Create new room
  const createRoom = () => {
    if (!newRoomName.trim()) return

    // Join new room
    joinRoom(newRoomName)
    setNewRoomName("")

    // Switch to new room
    const newChannel: ChatChannel = {
      id: newRoomName,
      name: newRoomName,
      type: "room",
    }

    changeChannel(newChannel)
  }

  // Filter channels based on search query
  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels || []

    return (channels || []).filter((channel) => channel.name.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [channels, searchQuery])

  // Total unread count
  const totalUnreadCount = Object.values(unreadDMs).reduce((sum, count) => sum + count, 0)

  // Show registration form if not registered
  if (!isRegistered) {
    return <LoginForm onLogin={registerUser} isConnected={isConnected} error={registrationError} />
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Sidebar for desktop */}
      {!isMobile && (
        <div className="w-72 border-r dark:border-gray-800 bg-white dark:bg-gray-950 flex flex-col">
          {/* User info */}
          <div className="p-4 border-b dark:border-gray-800">
            <div className="flex items-center space-x-2">
              <UserAvatar src={currentUser?.avatar} username={currentUser?.username || "User"} status="online" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{currentUser?.username}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="p-4 border-b dark:border-gray-800">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
              <Input
                placeholder="Search channels and users"
                className="pl-9 h-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="absolute right-2.5 top-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  onClick={() => setSearchQuery("")}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Channels */}
          <Tabs defaultValue="all" className="flex-1 flex flex-col">
            <div className="px-4 pt-4">
              <TabsList className="w-full">
                <TabsTrigger value="all" className="flex-1">
                  All
                </TabsTrigger>
                <TabsTrigger value="rooms" className="flex-1">
                  Channels
                </TabsTrigger>
                <TabsTrigger value="direct" className="flex-1 relative">
                  Direct
                  {totalUnreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 absolute -top-1 -right-1">
                      {totalUnreadCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="all" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div className="flex items-center justify-between px-4 py-2">
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
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && newRoomName.trim()) {
                              createRoom()
                            }
                          }}
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

              <ChannelList
                channels={filteredChannels}
                currentChannel={currentChannel}
                onSelectChannel={changeChannel}
              />
            </TabsContent>

            <TabsContent value="rooms" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div className="flex items-center justify-between px-4 py-2">
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
                        <Label htmlFor="room-name-tab">Channel name</Label>
                        <Input
                          id="room-name-tab"
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

              <ChannelList
                channels={filteredChannels.filter((channel) => channel.type === "room")}
                currentChannel={currentChannel}
                onSelectChannel={changeChannel}
              />
            </TabsContent>

            <TabsContent value="direct" className="flex-1 overflow-hidden flex flex-col mt-0">
              <div className="flex items-center justify-between px-4 py-2">
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Direct Messages</h3>
              </div>

              <ChannelList
                channels={filteredChannels.filter((channel) => channel.type === "direct")}
                currentChannel={currentChannel}
                onSelectChannel={changeChannel}
              />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <ChatHeader
          channel={currentChannel}
          isConnected={isConnected}
          onMenuClick={() => setSheetOpen(true)}
          isMobile={isMobile}
        />

        {/* Mobile sidebar */}
        {isMobile && (
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              {/* User info */}
              <div className="py-4 border-b dark:border-gray-800">
                <div className="flex items-center space-x-2">
                  <UserAvatar src={currentUser?.avatar} username={currentUser?.username || "User"} status="online" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{currentUser?.username}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Online</p>
                  </div>
                </div>
              </div>

              {/* Search */}
              <div className="py-4 border-b dark:border-gray-800">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
                  <Input
                    placeholder="Search channels and users"
                    className="pl-9 h-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="absolute right-2.5 top-2.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      onClick={() => setSearchQuery("")}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Channels */}
              <Tabs defaultValue="all" className="mt-4">
                <TabsList className="w-full">
                  <TabsTrigger value="all" className="flex-1">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="rooms" className="flex-1">
                    Channels
                  </TabsTrigger>
                  <TabsTrigger value="direct" className="flex-1 relative">
                    Direct
                    {totalUnreadCount > 0 && (
                      <Badge variant="destructive" className="ml-1 h-5 min-w-5 px-1 absolute -top-1 -right-1">
                        {totalUnreadCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="all" className="mt-2">
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

                  <ChannelList
                    channels={filteredChannels}
                    currentChannel={currentChannel}
                    onSelectChannel={changeChannel}
                  />
                </TabsContent>

                <TabsContent value="rooms" className="mt-2">
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
                            <Label htmlFor="room-name-mobile-tab">Channel name</Label>
                            <Input
                              id="room-name-mobile-tab"
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

                  <ChannelList
                    channels={filteredChannels.filter((channel) => channel.type === "room")}
                    currentChannel={currentChannel}
                    onSelectChannel={changeChannel}
                  />
                </TabsContent>

                <TabsContent value="direct" className="mt-2">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Direct Messages</h3>
                  </div>

                  <ChannelList
                    channels={filteredChannels.filter((channel) => channel.type === "direct")}
                    currentChannel={currentChannel}
                    onSelectChannel={changeChannel}
                  />
                </TabsContent>
              </Tabs>

              {/* Online users */}
              <div className="mt-4 border-t dark:border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Online Users</h3>
                  <Badge variant="secondary" className="text-xs">
                    {onlineCount}
                  </Badge>
                </div>
                <UserList
                  users={users.filter((user) => user.status === "online")}
                  selectedUserId={currentChannel?.type === "direct" ? currentChannel.recipientId : undefined}
                  onSelectUser={startDirectMessage}
                  unreadCounts={unreadDMs}
                  currentUserId={currentUser?.id}
                />
              </div>
            </SheetContent>
          </Sheet>
        )}

        {/* Messages Container */}
        {currentChannel ? (
          <>
            <MessageList
              messages={messages}
              currentUser={currentUser}
              typingUsers={currentChannel.type === "room" ? typingUsers : dmTypingUsers}
              users={users}
              isTyping={isTyping}
              messagesEndRef={messagesEndRef as React.RefObject<HTMLDivElement>}
            />

            <MessageInput
              placeholder={`Message ${currentChannel.type === "room" ? `#${currentChannel.name}` : currentChannel.name}`}
              onSubmit={sendMessage}
              onTyping={handleTyping}
              isSending={isSending}
              isConnected={isConnected}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Welcome to the Chat App</h2>
              <p className="text-gray-500">Select a channel or user to start chatting</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
