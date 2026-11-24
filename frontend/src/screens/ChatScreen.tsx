import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserPlus, MessageCircle, Inbox, Send, ArrowLeft, Ban } from 'lucide-react';
import type {
  ChatMessage,
  FriendListItem,
  FriendRequestItem,
  LookupResult,
  SafeUser,
} from '../types';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Tabs } from '../components/ui/Tabs';
import { FriendRow } from '../components/chat/FriendRow';
import { RequestCard } from '../components/chat/RequestCard';
import { ChatBubble } from '../components/chat/ChatBubble';
import { MessageComposer } from '../components/chat/MessageComposer';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { Modal } from '../components/ui/Modal';

interface ChatScreenProps {
  currentUser: SafeUser;
  isOnline: boolean;
  onPendingCountChange: (count: number) => void;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

type ChatTab = 'general' | 'sent' | 'received';

export const ChatScreen: React.FC<ChatScreenProps> = ({
  currentUser,
  isOnline,
  onPendingCountChange,
  onNotify,
}) => {
  const [tab, setTab] = useState<ChatTab>('general');
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);

  const [friends, setFriends] = useState<FriendListItem[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([]);

  const [lookupInput, setLookupInput] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [activeFriend, setActiveFriend] = useState<FriendListItem | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [blockTarget, setBlockTarget] = useState<SafeUser | null>(null);
  const [blocking, setBlocking] = useState(false);

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
      onPendingCountChange(rRes.requests.length);
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
    const socket = getSocket();
    if (!socket) return;

    const onMessageNew = (msg: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        if (msg.clientTempId && prev.some((m) => m.id === msg.clientTempId)) {
          return prev.map((m) => (m.id === msg.clientTempId ? msg : m));
        }
        if (msg.conversationId === activeConversationId) {
          return [...prev, msg];
        }
        return prev;
      });

      setFriends((prev) =>
        prev.map((item) =>
          item.conversationId === msg.conversationId
            ? {
                ...item,
                lastMessage: {
                  id: msg.id,
                  senderId: msg.senderId,
                  content: msg.content,
                  createdAt: msg.createdAt,
                },
              }
            : item
        )
      );
    };

    const onPresence = ({ userId, online }: { userId: string; online: boolean }) => {
      setFriends((prev) =>
        prev.map((f) => (f.friend.id === userId ? { ...f, online } : f))
      );
      setActiveFriend((prev) =>
        prev && prev.friend.id === userId ? { ...prev, online } : prev
      );
    };

    const onRequestReceived = (req: FriendRequestItem) => {
      setReceivedRequests((prev) => {
        if (prev.some((r) => r.id === req.id)) return prev;
        const next = [req, ...prev];
        onPendingCountChange(next.length);
        return next;
      });
      onNotify(`New friend request from @${req.user.username}`, 'info');
    };

    const onRefresh = () => {
      refreshHub();
    };

    socket.on('message:new', onMessageNew);
    socket.on('presence:update', onPresence);
    socket.on('friend:request:received', onRequestReceived);
    socket.on('friend:request:accepted', onRefresh);
    socket.on('friend:request:updated', onRefresh);
    socket.on('friend:request:canceled', onRefresh);

    return () => {
      socket.off('message:new', onMessageNew);
      socket.off('presence:update', onPresence);
      socket.off('friend:request:received', onRequestReceived);
      socket.off('friend:request:accepted', onRefresh);
      socket.off('friend:request:updated', onRefresh);
      socket.off('friend:request:canceled', onRefresh);
    };
  }, [activeConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const filteredFriends = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.friend.username.toLowerCase().includes(q) ||
        f.friend.primaryNickname.toLowerCase().includes(q)
    );
  }, [friends, filterText]);

  async function openConversation(item: FriendListItem) {
    setActiveFriend(item);
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
        setFriends((prev) =>
          prev.map((f) =>
            f.friend.id === item.friend.id ? { ...f, conversationId: convId } : f
          )
        );
      }
      setActiveConversationId(convId);
      const res = await apiFetch<{ messages: ChatMessage[] }>(
        `/api/chat/conversations/${convId}/messages`
      );
      setMessages(res.messages);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to open conversation.', 'error');
      setActiveFriend(null);
      setActiveConversationId(null);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendMessage(content: string, retryTempId?: string) {
    if (!activeConversationId) return;
    const tempId = retryTempId || `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    const optimistic: ChatMessage = {
      id: tempId,
      conversationId: activeConversationId,
      senderId: currentUser.id,
      clientTempId: tempId,
      content,
      deliveryState: 'SENDING',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) =>
      retryTempId ? prev.map((m) => (m.id === retryTempId ? optimistic : m)) : [...prev, optimistic]
    );

    if (!isOnline) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'FAILED' } : m))
      );
      onNotify('You are offline. Tap Retry when reconnected.', 'error');
      return;
    }

    try {
      const res = await apiFetch<{ message: ChatMessage }>(
        `/api/chat/conversations/${activeConversationId}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content, clientTempId: tempId }),
        }
      );
      setMessages((prev) => prev.map((m) => (m.id === tempId ? res.message : m)));
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, deliveryState: 'FAILED' } : m))
      );
      onNotify(err instanceof Error ? err.message : 'Message failed to send.', 'error');
    }
  }

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = lookupInput.trim();
    if (!cleaned) return;
    setLookupBusy(true);
    setLookupError(null);
    setLookupResult(null);
    try {
      const res = await apiFetch<LookupResult>(
        `/api/friends/lookup?username=${encodeURIComponent(cleaned)}`
      );
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
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to accept request.', 'error');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleDeny(requestId: string) {
    setActionBusyId(requestId);
    try {
      await apiFetch(`/api/friends/requests/${requestId}/deny`, { method: 'POST' });
      const next = receivedRequests.filter((r) => r.id !== requestId);
      setReceivedRequests(next);
      onPendingCountChange(next.length);
      onNotify('Friend request denied.', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to deny request.', 'error');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleCancelSent(requestId: string) {
    setActionBusyId(requestId);
    try {
      await apiFetch(`/api/friends/requests/${requestId}`, { method: 'DELETE' });
      setSentRequests((prev) => prev.filter((r) => r.id !== requestId));
      onNotify('Friend request canceled.', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to cancel request.', 'error');
    } finally {
      setActionBusyId(null);
    }
  }

  async function handleConfirmBlock() {
    if (!blockTarget) return;
    setBlocking(true);
    try {
      await apiFetch('/api/friends/blocks', {
        method: 'POST',
        body: JSON.stringify({ userId: blockTarget.id }),
      });
      if (activeFriend?.friend.id === blockTarget.id) {
        setActiveFriend(null);
        setActiveConversationId(null);
        setMessages([]);
      }
      setBlockTarget(null);
      onNotify(`Blocked @${blockTarget.username}. Manage blocks in Profile → Settings.`, 'success');
      await refreshHub();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to block user.', 'error');
    } finally {
      setBlocking(false);
    }
  }

  const conversationPanel = activeFriend ? (
    <section className="flex flex-col h-[calc(100dvh-10.5rem)] md:h-[calc(100dvh-4.5rem)] rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft">
      <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-cbox-border bg-cbox-surface shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => {
              setActiveFriend(null);
              setActiveConversationId(null);
            }}
            aria-label="Back to chat list"
            className="lg:hidden p-2 rounded-xl hover:bg-cbox-elevated text-cbox-muted hover:text-cbox-text"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar
            src={activeFriend.friend.avatarUrl}
            name={activeFriend.friend.primaryNickname}
            size="md"
            online={activeFriend.online}
          />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-cbox-text truncate">
              {activeFriend.friend.primaryNickname}
            </h2>
            <p className="text-xs text-cbox-muted truncate">
              @{activeFriend.friend.username} · {activeFriend.online ? 'Online' : 'Offline'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setBlockTarget(activeFriend.friend)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-cbox-danger hover:bg-cbox-danger/10 border border-cbox-danger/25 shrink-0"
        >
          <Ban className="h-3.5 w-3.5" />
          Block
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-cbox-bg/50">
        {loadingMessages ? (
          <LoadingSkeleton rows={4} />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle className="h-6 w-6" />}
            title={`Start chatting with ${activeFriend.friend.primaryNickname}`}
            description="Messages are persisted securely and synced in real time across desktop and Android."
          />
        ) : (
          messages.map((m) => (
            <ChatBubble
              key={m.id}
              message={m}
              isOwn={m.senderId === currentUser.id}
              onRetry={
                m.deliveryState === 'FAILED' ? () => sendMessage(m.content, m.id) : undefined
              }
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageComposer offline={!isOnline} onSend={(txt) => sendMessage(txt)} />
    </section>
  ) : (
    <div className="hidden lg:flex h-[calc(100dvh-4.5rem)] rounded-2xl border border-cbox-border bg-cbox-surface/60 items-center justify-center p-8">
      <EmptyState
        icon={<MessageCircle className="h-6 w-6" />}
        title="Select a friend to chat"
        description="Pick an accepted friend from the General list to open your private real-time conversation."
      />
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[340px_1fr] lg:gap-5 items-start">
      {/* Left Hub Column — hidden on mobile while a conversation is open */}
      <div className={`space-y-4 ${activeFriend ? 'hidden lg:block' : 'block'}`}>
        <div>
          <h1 className="text-xl font-bold text-cbox-text">Chat</h1>
          <p className="text-xs text-cbox-muted">
            Accepted friends and incoming/outgoing friend requests.
          </p>
        </div>

        <div className="relative">
          <Search className="h-4 w-4 text-cbox-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter friends by name or @username…"
            aria-label="Filter friends"
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-cbox-surface border border-cbox-border text-base sm:text-sm text-cbox-text placeholder:text-cbox-muted"
          />
        </div>

        <Tabs
          active={tab}
          onChange={setTab}
          options={[
            { id: 'general', label: 'General', badge: friends.length },
            { id: 'sent', label: 'Sent', badge: sentRequests.length },
            { id: 'received', label: 'Received', badge: receivedRequests.length },
          ]}
        />

        {loading ? (
          <LoadingSkeleton rows={4} />
        ) : tab === 'general' ? (
          filteredFriends.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title={friends.length === 0 ? 'No friends yet' : 'No matching friends'}
              description={
                friends.length === 0
                  ? 'Open Sent to find a friend by exact username and start a private 1:1 chat.'
                  : 'Try clearing your search filter.'
              }
            />
          ) : (
            <div className="space-y-2.5">
              {filteredFriends.map((item) => (
                <FriendRow
                  key={item.friend.id}
                  item={item}
                  selected={activeFriend?.friend.id === item.friend.id}
                  onSelect={() => openConversation(item)}
                  onBlock={() => setBlockTarget(item.friend)}
                  onReportSoon={() =>
                    onNotify('User reporting is planned for a future safety release.', 'info')
                  }
                />
              ))}
            </div>
          )
        ) : tab === 'sent' ? (
          <div className="space-y-4">
            <form
              onSubmit={handleLookup}
              className="p-4 rounded-2xl border border-cbox-border bg-cbox-surface space-y-3"
            >
              <label className="block text-xs font-semibold uppercase tracking-wider text-cbox-muted">
                Add friend by exact username
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoCapitalize="none"
                  value={lookupInput}
                  onChange={(e) => setLookupInput(e.target.value)}
                  placeholder="e.g. alex_rivera"
                  className="flex-1 min-w-0 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-base sm:text-sm text-cbox-text"
                />
                <button
                  type="submit"
                  disabled={lookupBusy || !lookupInput.trim()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm hover:bg-cbox-accentHover disabled:opacity-50 shrink-0"
                >
                  <Search className="h-4 w-4" />
                  {lookupBusy ? '…' : 'Find'}
                </button>
              </div>

              {lookupError && <p className="text-xs text-cbox-danger">{lookupError}</p>}

              {lookupResult && (
                <div className="p-3 rounded-xl bg-cbox-elevated border border-cbox-border flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={lookupResult.user.avatarUrl}
                      name={lookupResult.user.primaryNickname}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-cbox-text truncate">
                        {lookupResult.user.primaryNickname}
                      </p>
                      <p className="text-xs text-cbox-muted">@{lookupResult.user.username}</p>
                    </div>
                  </div>

                  {lookupResult.relationship === 'NONE' ? (
                    <button
                      type="button"
                      disabled={actionBusyId === 'send'}
                      onClick={() => handleSendRequest(lookupResult.user.username)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cbox-accent text-slate-950 text-xs font-semibold hover:bg-cbox-accentHover disabled:opacity-50"
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      Send
                    </button>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-cbox-surface border border-cbox-border text-cbox-muted">
                      {lookupResult.relationship === 'FRIENDS'
                        ? 'Already friends'
                        : lookupResult.relationship === 'PENDING_SENT'
                          ? 'Pending'
                          : lookupResult.relationship === 'PENDING_RECEIVED'
                            ? 'Check Received'
                            : 'Blocked'}
                    </span>
                  )}
                </div>
              )}
            </form>

            {sentRequests.length === 0 ? (
              <EmptyState
                icon={<Send className="h-6 w-6" />}
                title="No pending sent requests"
                description="Search an exact username above to preview their profile and send a request."
              />
            ) : (
              <div className="space-y-2.5">
                {sentRequests.map((req) => (
                  <RequestCard
                    key={req.id}
                    request={req}
                    direction="sent"
                    busy={actionBusyId === req.id}
                    onCancel={() => handleCancelSent(req.id)}
                  />
                ))}
              </div>
            )}
          </div>
        ) : receivedRequests.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No incoming requests"
            description="When someone sends you a friend request, accept or deny it right here."
          />
        ) : (
          <div className="space-y-2.5">
            {receivedRequests.map((req) => (
              <RequestCard
                key={req.id}
                request={req}
                direction="received"
                busy={actionBusyId === req.id}
                onAccept={() => handleAccept(req.id)}
                onDeny={() => handleDeny(req.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Conversation Column — full screen on mobile when selected, side-by-side on desktop */}
      <div className={activeFriend ? 'block' : 'hidden lg:block'}>{conversationPanel}</div>

      <Modal
        open={Boolean(blockTarget)}
        onClose={() => setBlockTarget(null)}
        title={`Block @${blockTarget?.username}?`}
        description="Blocking removes the friendship and prevents new direct messages and friend requests between both accounts."
        maxWidthClass="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setBlockTarget(null)}
            className="px-4 py-2 rounded-xl text-sm border border-cbox-border text-cbox-text"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={blocking}
            onClick={handleConfirmBlock}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-cbox-danger text-white disabled:opacity-50"
          >
            {blocking ? 'Blocking…' : 'Block user'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
