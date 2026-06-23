"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { ChatMessage } from "@/types"

interface ChatState {
  messages: ChatMessage[]
  isStreaming: boolean
  currentRepositoryId: string | null
  conversations: Record<string, ChatMessage[]>
  conversationNames: Record<string, string>

  addMessage: (message: ChatMessage) => void
  setMessages: (messages: ChatMessage[]) => void
  setIsStreaming: (streaming: boolean) => void
  setCurrentRepository: (id: string | null) => void
  clearMessages: () => void
  appendToLastMessage: (content: string) => void
  deleteConversation: (id: string) => void
  renameConversation: (id: string, name: string) => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messages: [],
      isStreaming: false,
      currentRepositoryId: null,
      conversations: {},
      conversationNames: {},

      addMessage: (message) =>
        set((state) => {
          const messages = [...state.messages, message]
          return {
            messages,
            conversations: state.currentRepositoryId
              ? { ...state.conversations, [state.currentRepositoryId]: messages }
              : state.conversations,
          }
        }),
      setMessages: (messages) =>
        set((state) => ({
          messages,
          conversations: state.currentRepositoryId
            ? { ...state.conversations, [state.currentRepositoryId]: messages }
            : state.conversations,
        })),
      setIsStreaming: (isStreaming) => set({ isStreaming }),
      setCurrentRepository: (id) =>
        set((state) => ({
          currentRepositoryId: id,
          messages: id ? state.conversations[id] || [] : [],
        })),
      clearMessages: () => set({ messages: [] }),
      appendToLastMessage: (content) =>
        set((state) => {
          const messages = [...state.messages]
          const last = messages[messages.length - 1]
          if (last && last.role === "assistant") {
            messages[messages.length - 1] = { ...last, content: last.content + content }
          }
          return { messages }
        }),
      deleteConversation: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.conversations
          const { [id]: __, ...namesRest } = state.conversationNames
          return {
            conversations: rest,
            conversationNames: namesRest,
            messages: state.currentRepositoryId === id ? [] : state.messages,
            currentRepositoryId: state.currentRepositoryId === id ? null : state.currentRepositoryId,
          }
        }),
      renameConversation: (id, name) =>
        set((state) => ({
          conversationNames: { ...state.conversationNames, [id]: name },
        })),
    }),
    {
      name: "codemind-chat",
    }
  )
)