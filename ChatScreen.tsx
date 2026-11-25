import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  UserPlus,
  MessageCircle,
  Inbox,
  Send,
  ArrowLeft,
  Ban,
  Lock,
  Timer,
  EyeOff,
  Phone,
  Video,
} from 'lucide-react';
import type {
  ChatMessage,
  FriendListItem,
  FriendRequestItem,
  LookupResult,
  SafeUser,
} from '../types';
import { apiFetch, apiUploadWithProgress } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Tabs } from '../components/ui/Tabs';
import { FriendRow } from '../components/chat/FriendRow';
import { RequestCard } from '../components/chat/RequestCard';
import { ChatBubble } from '../components/chat/ChatBubble';
import { MessageComposer } from '../components/chat/MessageComposer';
import { GroupChatPanel } from '../components/chat/GroupChatPanel';
import { UserProfileModal } from '../components/profile/UserProfileModal';
import { ReportModal } from '../components/ui/ReportModal';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';

interface ChatScreenProps {
  currentUser: SafeUser;
  isOnline: boolean;
  onBadgeCountChange: (count: number) => void;
  onStartCall: (friend: SafeUser, kind: 'audio' | 'video') => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type ChatTab = 'general' | 'groups' | 'sent' | 'received';

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  isOnline,
  onBadgeCountChange,
  onStartCall,
  onNotify,
}) => {
  const [tab, setTab] = useState<ChatTab>('general');
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);

  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);

  const [vaultUnlocked, setVaultUnlocked] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);

  const [lookupInput, setLookupInput] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [activeFriend, setActiveFriend] = useState<FriendListItem | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [disappearSeconds, setDisappearSeconds] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [friendTyping, setFriendTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [blockTarget, setBlockTarget] = useState<SafeUser | null>(null);
  const [reportUser, setReportUser] = useState<SafeUser | null>(null);
  const [blocking, setBlocking] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);

  function syncTotalBadge(friendList: FriendListItem[], reqList: FriendRequestItem[]) {
    const unread = friendList.reduce((acc, f) => acc + (f.unreadCount || 0), 0);
    onBadgeCountChange(unread + reqList.length);
  }

  async function refreshHub() {
    setLoading(true);
    try {
      const [gRes, sRes, rRes] = await Promise.all([
        apiFetch<{ friends: FriendListItem[] }>('/api/friends/general'),
        apiFetch<{ requests: FriendRequestItem[] }>('/api/friends/requests/sent'),
        apiFetch<{ requests: FriendRequestItem[] }>('/api/friends/requests/received'),
      ]);
      setFriends(gRes.friends);
      setSentRequests(sRes.requests);
      setReceivedRequests(rRes.requests);
      syncTotalBadge(gRes.friends, rRes.requests);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load chat hub.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshHub();
  }, []);

  useEffect(() => {
    syncTotalBadge(friends, receivedRequests);
  }, [friends, receivedRequests]);

  function markConversationRead(convId: string) {
    apiFetch(`/api/chat/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
    setFriends((prev) => prev.map((f) => (f.conversationId === convId ? { ...f, unreadCount: 0 } : f)));
  }

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onMessageNew = (msg: ChatMessage) => {
      const isActive = msg.conversationId === activeConversationId;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (msg.clientTempId && prev.some((m) => m.id === msg.clientTempId)) {
          return prev.map((m) => (m.id === msg.clientTempId ? msg : m));
        }
        if (isActive) return [...prev, msg];
        return prev;
      });
      if (isActive && msg.senderId !== currentUser.id) {
        markConversationRead(msg.conversationId);
        setFriendTyping(false);
      }
      setFriends((prev) =>
        prev.map((item) =>
          item.conversationId === msg.conversationId
            ? {
                ...item,
                unreadCount: !isActive && msg.senderId !== currentUser.id ? (item.unreadCount || 0) + 1 : item.unreadCount,
                lastMessage: {
                  id: msg.id,
                  senderId: msg.senderId,
                  content: msg.mediaKind === 'IMAGE' ? msg.content || '📷 Photo' : msg.mediaKind === 'AUDIO' ? '🎤 Voice note' : msg.content,
                  createdAt: msg.createdAt,
                },
              }
            : item
        )
      );
    };

    const onMessageUpdated = (msg: ChatMessage) => setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)));
    const onMessageRead = ({ conversationId }: { conversationId: string }) => {
      if (conversationId === activeConversationId) {
        setMessages((prev) => prev.map((m) => (m.senderId === currentUser.id ? { ...m, deliveryState: 'READ' } : m)));
      }
    };
    const onDisappear = (data: { conversationId: string; disappearAfterSeconds: number }) => {
      if (data.conversationId === activeConversationId) setDisappearSeconds(data.disappearAfterSeconds);
    };
    const onTyping = (data: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (data.conversationId === activeConversationId && data.userId !== currentUser.id) setFriendTyping(data.isTyping);
    };
    const onPresence = ({ userId, online }: { userId: string; online: boolean }) => {
      setFriends((prev) => prev.map((f) => (f.friend.id === userId ? { ...f, online } : f)));
      setActiveFriend((prev) => (prev && prev.friend.id === userId ? { ...prev, online } : prev));
    };
    const onRequestReceived = (req: FriendRequestItem) => {
      setReceivedRequests((prev) => (prev.some((r) => r.id === req.id) ? prev : [req, ...prev]));
      onNotify(`New friend request from @${req.user.username}`, 'info');
    };
    const onRefresh = () => refreshHub();

    socket.on('message:new', onMessageNew);
    socket.on('message:updated', onMessageUpdated);
    socket.on('message:read', onMessageRead);
    socket.on('conversation:disappear', onDisappear);
    socket.on('chat:typing', onTyping);
    socket.on('presence:update', onPresence);
    socket.on('friend:request:received', onRequestReceived);
    socket.on('friend:request:accepted', onRefresh);
    socket.on('friend:request:updated', onRefresh);
    socket.on('friend:request:canceled', onRefresh);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('message:updated', onMessageUpdated);
      socket.off('message:read', onMessageRead);
      socket.off('conversation:disappear', onDisappear);
      socket.off('chat:typing', onTyping);
      socket.off('presence:update', onPresence);
      socket.off('friend:request:received', onRequestReceived);
      socket.off('friend:request:accepted', onRefresh);
      socket.off('friend:request:updated', onRefresh);
      socket.off('friend:request:canceled', onRefresh);
    };
  }, [activeConversationId, currentUser.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, friendTyping]);

  const vaultCount = useMemo(() => friends.filter((f) => f.hiddenInVault).length, [friends]);

  const filteredFriends = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return friends.filter((f) => {
      if (Boolean(f.hiddenInVault) !== vaultUnlocked) return false;
      if (!q) return true;
      return f.friend.username.toLowerCase().includes(q) || f.friend.primaryNickname.toLowerCase().includes(q);
    });
  }, [friends, filterText, vaultUnlocked]);

  async function handleUnlockVault(e: React.FormEvent) {
    e.preventDefault();
    setPinError(null);
    try {
      await apiFetch('/api/auth/secret-pin/verify', { method: 'POST', body: JSON.stringify({ pin: pinInput }) });
      setVaultUnlocked(true);
      setPinModalOpen(false);
      setPinInput('');
    } catch (err) {
      setPinError(err instanceof Error ? err.message : 'Incorrect PIN.');
    }
  }

  async function openConversation(item: FriendListItem) {
    setActiveFriend(item);
    setDisappearSeconds(item.disappearAfterSeconds || 0);
    setFriendTyping(false);
    setReplyTo(null);
    setLoadingMessages(true);
    setMessages([]);
    try {
      let convId = item.conversationId;
      if (!convId) {
        const created = await apiFetch<{ conversation: { id: string } }>(
          `/api/chat/conversations/with/${item.friend.id}`,
          { method: 'POST' }
        );
        convId = created.conversation.id;
        setFriends((prev) => prev.map((f) => (f.friend.id === item.friend.id ? { ...f, conversationId: convId } : f)));
      }
      setActiveConversationId(convId);
      const res = await apiFetch<{ conversation: { disappearAfterSeconds: number }; messages: ChatMessage[] }>(
        `/api/chat/conversations/${convId}/messages`
      );
      setMessages(res.messages);
      setDisappearSeconds(res.conversation.disappearAfterSeconds || 0);
      markConversationRead(convId);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to open conversation.', 'error');
      setActiveFriend(null);
      setActiveConversationId(null);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function handleToggleVaultForActive() {
    if (!activeConversationId || !activeFriend) return;
    const nextHidden = !activeFriend.hiddenInVault;
    try {
      await apiFetch(`/api/chat/conversations/${activeConversationId}/vault`, {
        method: 'PATCH',
        body: JSON.stringify({ hidden: nextHidden }),
      });
      setFriends((prev) =>
        prev.map((f) => (f.conversationId === activeConversationId ? { ...f, hiddenInVault: nextHidden } : f))
      );
      setActiveFriend((prev) => (prev ? { ...prev, hiddenInVault: nextHidden } : prev));
      onNotify(nextHidden ? 'Chat moved to Secret Vault.' : 'Chat restored to General.', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update vault.', 'error');
    }
  }

  async function handleSetDisappear(seconds: number) {
    if (!activeConversationId) return;
    try {
      await apiFetch(`/api/chat/conversations/${activeConversationId}/disappear`, {
        method: 'PATCH',
        body: JSON.stringify({ seconds }),
      });
      setDisappearSeconds(seconds);
      onNotify(seconds === 0 ? 'Disappearing timer off.' : 'Disappearing timer updated.', 'info');
    } catch {}
  }

  function handleTypingChange(isTyping: boolean) {
    const socket = getSocket();
    if (socket && activeConversationId) socket.emit('chat:typing', { conversationId: activeConversationId, isTyping });
  }

  async function sendMessage(content: string, retryTempId?: string) {
    if (!activeConversationId) return;
    const tempId = retryTempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const replyRef = replyTo;
    setReplyTo(null);
    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      clientTempId: tempId,
      content,
      replyTo: replyRef ? { id: replyRef.id, senderId: replyRef.senderId, content: replyRef.content } : null,
      deliveryState: 'SENDING',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) =>
      retryTempId ? prev.map((m) => (m.id === retryTempId ? optimistic : m)) : [...prev, optimistic]
    );
    if (!isOnline) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'FAILED' } : m)));
      return;
    }
    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/chat/conversations/${activeConversationId}/messages`,
        { method: 'POST', body: JSON.stringify({ content, clientTempId: tempId, replyToId: replyRef?.id }) }
      );
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'FAILED' } : m)));
    }
  }

  async function handleSendMedia(file: File, caption: string) {
    if (!activeConversationId) return;
    const fd = new FormData();
    fd.append('file', file);
    if (caption) fd.append('caption', caption);
    if (replyTo) fd.append('replyToId', replyTo.id);
    setReplyTo(null);
    try {
      const res = await apiUploadWithProgress<{ message: ChatMessage }>(
        `/api/chat/conversations/${activeConversationId}/media`,
        fd
      );
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Media upload failed.', 'error');
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/messages/${messageId}/reactions`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    } catch {}
  }

  async function handleEditMessage(messageId: string, content: string) {
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ content }),
      });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    } catch {}
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      const res = await apiFetch<{ message: ChatMessage }>(`/api/chat/messages/${messageId}`, { method: 'DELETE' });
      setMessages((prev) => prev.map((m) => (m.id === messageId ? res.message : m)));
    } catch {}
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!lookupInput.trim()) return;
    setLookupBusy(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await apiFetch<LookupResult>(`/api/friends/lookup?username=${encodeURIComponent(lookupInput.trim())}`);
      setLookupResult(res);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : 'User lookup failed.');
    } finally {
      setLookupBusy(false);
    }
  }

  async function handleSendRequest(username: string) {
    setActionBusyId('send');
    try {
      const res = await apiFetch<{ request: FriendRequestItem }>('/api/friends/requests', {
        method: 'POST',
        body: JSON.stringify({ username }),
      });
      setSentRequests((prev) => [res.request, ...prev]);
      setLookupResult(null);
      setLookupInput('');
      onNotify(`Friend request sent to @${username}.`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not send request.', 'error');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleAccept(requestId: string) {
    setActionBusyId(requestId);
    try {
      await apiFetch(`/api/friends/requests/${requestId}/accept`, { method: 'POST' });
      onNotify('Friend request accepted.', 'success');
      await refreshHub();
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDeny(requestId: string) {
    setActionBusyId(requestId);
    try {
      await apiFetch(`/api/friends/requests/${requestId}/deny`, { method: 'POST' });
      setReceivedRequests((prev) => prev.filter((r) => r.id !== requestId));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelSent(requestId: string) {
    setActionBusyId(requestId);
    try {
      await apiFetch(`/api/friends/requests/${requestId}`, { method: 'DELETE' });
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmBlock() {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await apiFetch('/api/friends/blocks', { method: 'POST', body: JSON.stringify({ userId: blockTarget.id }) });
      if (activeFriend?.friend.id === blockTarget.id) {
        setActiveFriend(null);
        setActiveConversationId(null);
        setMessages([]);
      }
      setBlockTarget(null);
      onNotify(`Blocked @${blockTarget.username}.`, 'success');
      await refreshHub();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to block user.', 'error');
    } finally {
      setBlocking(false);
    }
  }

  if (tab === 'groups') {
    return (
      <div className="space-y-4 animate-fade-slide">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-cbox-text">Groups & Communities</h1>
            <p className="text-xs text-cbox-muted">Group chats, invite links, @mentions & live polls.</p>
          </div>
        </div>
        <Tabs
          active={tab}
          onChange={setTab}
          options={[
            { id: 'general', label: 'General', badge: filteredFriends.length },
            { id: 'groups', label: 'Groups' },
            { id: 'sent', label: 'Sent', badge: sentRequests.length },
            { id: 'received', label: 'Received', badge: receivedRequests.length },
          ]}
        />
        <GroupChatPanel friends={friends} onNotify={onNotify} />
      </div>
    );
  }

  const conversationPanel = activeFriend ? (
    <section className="flex flex-col h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-4.5rem)] rounded-2xl border border-cbox-border bg-cbox-surface/95 backdrop-blur-md overflow-hidden shadow-soft animate-fade-slide">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-cbox-border bg-cbox-surface shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              setActiveFriend(null);
              setActiveConversationId(null);
            }}
            className="lg:hidden p-2 rounded-xl hover:bg-cbox-elevated text-cbox-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setProfileUsername(activeFriend.friend.username)}
            className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-90"
          >
            <Avatar src={activeFriend.friend.avatarUrl} name={activeFriend.friend.primaryNickname} size="md" online={activeFriend.online} />
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-cbox-text truncate">{activeFriend.friend.primaryNickname}</h2>
              <p className="text-xs text-cbox-muted truncate">
                {friendTyping ? <span className="text-cbox-accent font-medium">typing…</span> : `@${activeFriend.friend.username}`}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Phase 4 WebRTC Voice & Video Call Buttons */}
          <button
            type="button"
            onClick={() => onStartCall(activeFriend.friend, 'audio')}
            title="Voice Call"
            className="p-2 rounded-xl bg-cbox-elevated border border-cbox-border text-cbox-accent hover:bg-cbox-accent/15 transition"
          >
            <Phone className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onStartCall(activeFriend.friend, 'video')}
            title="Video Call"
            className="p-2 rounded-xl bg-cbox-elevated border border-cbox-border text-cbox-violet hover:bg-cbox-violet/15 transition"
          >
            <Video className="h-4 w-4" />
          </button>

          <label className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-cbox-elevated border border-cbox-border text-[11px] text-cbox-muted">
            <Timer className="h-3.5 w-3.5 text-cbox-violet" />
            <select
              aria-label="Disappearing messages timer"
              value={disappearSeconds}
              onChange={(e) => handleSetDisappear(Number(e.target.value))}
              className="bg-transparent text-cbox-text font-medium focus:outline-none"
            >
              <option value={0}>Off</option>
              <option value={300}>5m</option>
              <option value={3600}>1h</option>
              <option value={86400}>24h</option>
            </select>
          </label>

          <button
            type="button"
            onClick={handleToggleVaultForActive}
            title={activeFriend.hiddenInVault ? 'Unhide from Secret Vault' : 'Hide in Secret Vault'}
            className={`p-2 rounded-xl border transition ${
              activeFriend.hiddenInVault ? 'border-cbox-violet bg-cbox-violet/15 text-cbox-violet' : 'border-cbox-border text-cbox-muted'
            }`}
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setBlockTarget(activeFriend.friend)}
            title="Block user"
            className="p-2 rounded-xl text-cbox-danger hover:bg-cbox-danger/10 border border-cbox-danger/25"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cbox-bg/50">
        {loadingMessages ? (
          <LoadingSkeleton rows={4} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-6 w-6" />}
            title={`Start chatting with ${activeFriend.friend.primaryNickname}`}
            description="Send text, photos, voice notes, or tap the phone/video icon to call."
          />
        ) : (
          messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              isOwn={m.senderId === currentUser.id}
              currentUserId={currentUser.id}
              friendName={activeFriend.friend.primaryNickname}
              onRetry={m.deliveryState === 'FAILED' ? () => sendMessage(m.content, m.id) : undefined}
              onReply={() => setReplyTo(m)}
              onReact={(emoji) => handleReact(m.id, emoji)}
              onEdit={m.senderId === currentUser.id ? (txt) => handleEditMessage(m.id, txt) : undefined}
              onDelete={m.senderId === currentUser.id ? () => handleDeleteMessage(m.id) : undefined}
            />
          ))
        )}
        {friendTyping && <div className="text-xs text-cbox-muted italic px-2">{activeFriend.friend.primaryNickname} is typing…</div>}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer
        offline={!isOnline}
        replyTo={replyTo}
        replyAuthorName={replyTo ? (replyTo.senderId === currentUser.id ? 'yourself' : activeFriend.friend.primaryNickname) : undefined}
        onCancelReply={() => setReplyTo(null)}
        onTypingChange={handleTypingChange}
        onSend={(txt) => sendMessage(txt)}
        onSendMedia={handleSendMedia}
      />
    </section>
  ) : (
    <div className="hidden lg:flex h-[calc(100dvh-4.5rem)] rounded-2xl border border-cbox-border bg-cbox-surface/60 backdrop-blur-md items-center justify-center p-8">
      <EmptyState
        icon={<MessageCircle className="h-6 w-6" />}
        title="Select a friend to chat or call"
        description="Pick an accepted friend from the General list for 1:1 messaging, voice notes, or video calls."
      />
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-5 items-start animate-fade-slide">
      <div className={`space-y-4 ${activeFriend ? 'hidden lg:block' : 'block'}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold text-cbox-text">Chat</h1>
            <p className="text-xs text-cbox-muted">{vaultUnlocked ? 'Secret Vault (Unlocked)' : 'Friends, groups & requests'}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (vaultUnlocked) setVaultUnlocked(false);
              else {
                setPinError(null);
                setPinInput('');
                setPinModalOpen(true);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
              vaultUnlocked ? 'border-cbox-violet bg-cbox-violet text-white' : 'border-cbox-violet/40 bg-cbox-violet/10 text-cbox-violet'
            }`}
          >
            <Lock className="h-3.5 w-3.5" />
            {vaultUnlocked ? 'Lock' : `Vault${vaultCount > 0 ? ` (${vaultCount})` : ''}`}
          </button>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter friends…"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cbox-surface border border-cbox-border text-base sm:text-sm text-cbox-text"
          />
        </div>

        <Tabs
          active={tab}
          onChange={setTab}
          options={[
            { id: 'general', label: vaultUnlocked ? 'Vault' : 'General', badge: filteredFriends.length },
            { id: 'groups', label: 'Groups' },
            { id: 'sent', label: 'Sent', badge: sentRequests.length },
            { id: 'received', label: 'Received', badge: receivedRequests.length },
          ]}
        />

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : tab === 'general' ? (
          filteredFriends.length === 0 ? (
            <EmptyState
              icon={vaultUnlocked ? <Lock className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
              title={vaultUnlocked ? 'No hidden chats in Vault' : 'No friends yet'}
              description={vaultUnlocked ? 'Tap the eye-off icon inside any chat to hide it here.' : 'Open Sent to find a friend by exact username.'}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredFriends.map((item) => (
                <FriendRow
                  key={item.friend.id}
                  item={item}
                  selected={activeFriend?.friend.id === item.friend.id}
                  onSelect={() => openConversation(item)}
                  onViewProfile={() => setProfileUsername(item.friend.username)}
                  onBlock={() => setBlockTarget(item.friend)}
                  onReportSoon={() => setReportUser(item.friend)}
                />
              ))}
            </div>
          )
        ) : tab === 'sent' ? (
          <div className="space-y-4">
            <form onSubmit={handleLookup} className="p-4 rounded-2xl border border-cbox-border bg-cbox-surface space-y-3">
              <label className="block text-xs font-semibold uppercase tracking-wider text-cbox-muted">Add friend by exact username</label>
              <div className="flex gap-2">
                <input type="text" autoCapitalize="none" value={lookupInput} onChange={(e) => setLookupInput(e.target.value)} placeholder="e.g. alex_rivera" className="flex-1 min-w-0 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-sm text-cbox-text" />
                <button type="submit" disabled={lookupBusy || !lookupInput.trim()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm disabled:opacity-50">
                  <Search className="h-4 w-4" /> Find
                </button>
              </div>
              {lookupError && <p className="text-xs text-cbox-danger">{lookupError}</p>}
              {lookupResult && (
                <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar src={lookupResult.user.avatarUrl} name={lookupResult.user.primaryNickname} size="sm" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cbox-text truncate">{lookupResult.user.primaryNickname}</p>
                      <p className="text-xs text-cbox-muted">@{lookupResult.user.username}</p>
                    </div>
                  </div>
                  {lookupResult.relationship === 'NONE' ? (
                    <button type="button" disabled={actionBusyId === 'send'} onClick={() => handleSendRequest(lookupResult.user.username)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-semibold">
                      <UserPlus className="h-3.5 w-3.5" /> Send
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] bg-cbox-surface border border-cbox-border text-cbox-muted">{lookupResult.relationship}</span>
                  )}
                </div>
              )}
            </form>
            {sentRequests.length === 0 ? (
              <EmptyState icon={<Send className="h-6 w-6" />} title="No pending sent requests" description="Search an exact username above to send a friend request." />
            ) : (
              <div className="space-y-2.5">
                {sentRequests.map((req) => (
                  <RequestCard key={req.id} request={req} direction="sent" busy={actionBusyId === req.id} onCancel={() => handleCancelSent(req.id)} />
                ))}
              </div>
            )}
          </div>
        ) : receivedRequests.length === 0 ? (
          <EmptyState icon={<Inbox className="h-6 w-6" />} title="No incoming requests" description="Incoming friend requests appear here." />
        ) : (
          <div className="space-y-2.5">
            {receivedRequests.map((req) => (
              <RequestCard key={req.id} request={req} direction="received" busy={actionBusyId === req.id} onAccept={() => handleAccept(req.id)} onDeny={() => handleDeny(req.id)} />
            ))}
          </div>
        )}
      </div>

      <div className={activeFriend ? 'block' : 'hidden lg:block'}>{conversationPanel}</div>

      <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} />

      <Modal open={pinModalOpen} onClose={() => setPinModalOpen(false)} title="Unlock Secret Vault" maxWidthClass="max-w-sm">
        <form onSubmit={handleUnlockVault} className="space-y-4">
          <input type="password" inputMode="numeric" maxLength={6} required autoFocus value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))} placeholder="••••" className="w-full text-center text-lg tracking-[0.5em] rounded-xl bg-cbox-elevated border border-cbox-border px-4 py-3 text-cbox-text" />
          {pinError && <p className="text-xs text-cbox-danger text-center">{pinError}</p>}
          <button type="submit" className="w-full py-2.5 rounded-xl bg-cbox-violet text-white font-semibold text-sm">Unlock Vault</button>
        </form>
      </Modal>

      <ReportModal open={Boolean(reportUser)} targetLabel={reportUser ? `@${reportUser.username}` : 'user'} targetUserId={reportUser?.id} onClose={() => setReportUser(null)} onSubmitted={() => onNotify('Report submitted.', 'success')} />

      <Modal open={Boolean(blockTarget)} onClose={() => setBlockTarget(null)} title={`Block @${blockTarget?.username}?`} maxWidthClass="max-w-md">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setBlockTarget(null)} className="px-4 py-2 rounded-xl text-sm border border-cbox-border">Cancel</button>
          <button type="button" disabled={blocking} onClick={handleConfirmBlock} className="px-4 py-2 rounded-xl text-sm font-semibold bg-cbox-danger text-white">
            {blocking ? 'Blocking…' : 'Block user'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
