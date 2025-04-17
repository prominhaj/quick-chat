import { io, Socket } from "socket.io-client";

let socket: Socket;

export type User = {
    id: string
    username: string
    avatar: string
    status: "online" | "away" | "offline"
    lastSeen?: Date
}

export type Message = {
    id: string
    room: string
    content: string
    type: "text" | "image" | "file"
    sender: {
        id: string
        username: string
        avatar: string
    }
    timestamp: Date
}

export type Room = {
    name: string
    messages: Message[]
}

export const getSocket = (): Socket => {
    if (socket) {
        return socket;
    }
    socket = io(process.env.NEXT_PUBLIC_APP_URL as string, {
        autoConnect: false,
    });
    return socket;
};