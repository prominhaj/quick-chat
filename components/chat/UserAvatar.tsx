import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

type UserAvatarProps = {
    src?: string
    username?: string
    status?: "online" | "away" | "offline"
    size?: "sm" | "md" | "lg"
}

export function UserAvatar({ src, username = "User", status, size = "md" }: UserAvatarProps) {
    const sizeClasses = {
        sm: "h-6 w-6",
        md: "h-8 w-8",
        lg: "h-10 w-10",
    }

    const statusSizeClasses = {
        sm: "h-1.5 w-1.5",
        md: "h-2 w-2",
        lg: "h-2.5 w-2.5",
    }

    return (
        <div className="relative">
            <Avatar className={sizeClasses[size]}>
                <AvatarImage src={src || "/placeholder.svg"} />
                <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            {status && (
                <span
                    className={cn(
                        "absolute bottom-0 right-0 block rounded-full ring-1 ring-white dark:ring-gray-950",
                        statusSizeClasses[size],
                        status === "online" ? "bg-green-500" : status === "away" ? "bg-yellow-500" : "bg-gray-300",
                    )}
                />
            )}
        </div>
    )
}
