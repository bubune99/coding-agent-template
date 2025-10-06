"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  MessageSquare,
  MoreHorizontal,
  Edit2,
  Trash2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Users,
  Lock,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui-v0/input"

interface Chat {
  id: string
  name?: string
  privacy?: "public" | "private" | "team" | "team-edit" | "unlisted"
  createdAt: string
  url?: string
}

const getChatDisplayName = (chat: Chat): string => {
  return chat.name || `Chat ${chat.id.slice(0, 8)}...`
}

const getPrivacyIcon = (privacy: string) => {
  switch (privacy) {
    case "public":
      return <Eye className="h-4 w-4" />
    case "private":
      return <EyeOff className="h-4 w-4" />
    case "team":
    case "team-edit":
      return <Users className="h-4 w-4" />
    case "unlisted":
      return <Lock className="h-4 w-4" />
    default:
      return <EyeOff className="h-4 w-4" />
  }
}

const getPrivacyDisplayName = (privacy: string) => {
  switch (privacy) {
    case "public":
      return "Public"
    case "private":
      return "Private"
    case "team":
      return "Team"
    case "team-edit":
      return "Team Edit"
    case "unlisted":
      return "Unlisted"
    default:
      return "Private"
  }
}

export function ChatSelector() {
  const router = useRouter()
  const pathname = usePathname()
  const session = null
  const [chats, setChats] = useState<Chat[]>([])
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false)
  const [isVisibilityDialogOpen, setIsVisibilityDialogOpen] = useState(false)
  const [renameChatName, setRenameChatName] = useState("")
  const [selectedVisibility, setSelectedVisibility] = useState<
    "public" | "private" | "team" | "team-edit" | "unlisted"
  >("private")
  const [isRenamingChat, setIsRenamingChat] = useState(false)
  const [isDeletingChat, setIsDeletingChat] = useState(false)
  const [isDuplicatingChat, setIsDuplicatingChat] = useState(false)
  const [isChangingVisibility, setIsChangingVisibility] = useState(false)

  const currentChatId = pathname?.startsWith("/chats/") ? pathname.split("/")[2] : null

  const currentChat = currentChatId ? chats.find((c) => c.id === currentChatId) : null

  return (
    <>
      <div className="flex items-center gap-1">
        <Select value={currentChatId || ""}>
          <SelectTrigger className="w-fit min-w-[150px] max-w-[250px]" size="sm">
            <SelectValue placeholder="Select chat">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                <span className="truncate">{currentChat ? getChatDisplayName(currentChat) : "Select chat"}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {chats.length > 0 ? (
              chats.slice(0, 15).map((chat) => (
                <SelectItem key={chat.id} value={chat.id}>
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    <span className="truncate">{getChatDisplayName(chat)}</span>
                  </div>
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">No chats yet</div>
            )}
          </SelectContent>
        </Select>

        {/* Chat Context Menu */}
        {currentChat && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={isRenamingChat || isDeletingChat || isDuplicatingChat || isChangingVisibility}
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">Chat options</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a
                  href={`https://v0.app/chat/${currentChatId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View on v0.dev
                </a>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDuplicateDialogOpen(true)}
                disabled={isRenamingChat || isDeletingChat || isDuplicatingChat || isChangingVisibility}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate Chat
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setSelectedVisibility(currentChat.privacy || "private")
                  setIsVisibilityDialogOpen(true)
                }}
                disabled={isRenamingChat || isDeletingChat || isDuplicatingChat || isChangingVisibility}
              >
                {getPrivacyIcon(currentChat.privacy || "private")}
                <span className="ml-2">Change Visibility</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setRenameChatName(currentChat.name || "")
                  setIsRenameDialogOpen(true)
                }}
                disabled={isRenamingChat || isDeletingChat || isDuplicatingChat || isChangingVisibility}
              >
                <Edit2 className="mr-2 h-4 w-4" />
                Rename Chat
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={isRenamingChat || isDeletingChat || isDuplicatingChat || isChangingVisibility}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Rename Chat Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Chat</DialogTitle>
            <DialogDescription>Enter a new name for this chat.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Chat name"
              value={renameChatName}
              onChange={(e) => setRenameChatName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isRenamingChat) {
                  // Placeholder for handleRenameChat function
                }
              }}
              disabled={isRenamingChat}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsRenameDialogOpen(false)
                setRenameChatName("")
              }}
              disabled={isRenamingChat}
            >
              Cancel
            </Button>
            <Button onClick={() => {}} disabled={isRenamingChat || !renameChatName.trim()}>
              {isRenamingChat ? "Renaming..." : "Rename Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Chat Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Chat</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this chat? This action cannot be undone and will permanently remove the
              chat and all its messages.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeletingChat}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => {}} disabled={isDeletingChat}>
              {isDeletingChat ? "Deleting..." : "Delete Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Chat Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate Chat</DialogTitle>
            <DialogDescription>
              This will create a copy of the current chat. You'll be redirected to the new chat once it's created.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDuplicateDialogOpen(false)} disabled={isDuplicatingChat}>
              Cancel
            </Button>
            <Button onClick={() => {}} disabled={isDuplicatingChat}>
              {isDuplicatingChat ? "Duplicating..." : "Duplicate Chat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Visibility Dialog */}
      <Dialog open={isVisibilityDialogOpen} onOpenChange={setIsVisibilityDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Chat Visibility</DialogTitle>
            <DialogDescription>Choose who can see and access this chat.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select
              value={selectedVisibility}
              onValueChange={(value: "public" | "private" | "team" | "team-edit" | "unlisted") =>
                setSelectedVisibility(value)
              }
            >
              <SelectTrigger>
                <SelectValue>
                  <div className="flex items-center gap-2">
                    {getPrivacyIcon(selectedVisibility)}
                    <span>{getPrivacyDisplayName(selectedVisibility)}</span>
                  </div>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <EyeOff className="h-4 w-4" />
                    <div>
                      <div>Private</div>
                      <div className="text-xs text-muted-foreground">Only you can see this chat</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="public">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    <div>
                      <div>Public</div>
                      <div className="text-xs text-muted-foreground">Anyone can see this chat</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="team">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div>Team</div>
                      <div className="text-xs text-muted-foreground">Team members can see this chat</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="team-edit">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <div>
                      <div>Team Edit</div>
                      <div className="text-xs text-muted-foreground">Team members can see and edit this chat</div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="unlisted">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <div>
                      <div>Unlisted</div>
                      <div className="text-xs text-muted-foreground">Only people with the link can see this chat</div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVisibilityDialogOpen(false)} disabled={isChangingVisibility}>
              Cancel
            </Button>
            <Button onClick={() => {}} disabled={isChangingVisibility}>
              {isChangingVisibility ? "Changing..." : "Change Visibility"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
