import React, { useEffect, useRef, useState } from 'react';
import {
  Users,
  Plus,
  Link2,
  BarChart3,
  Send,
  LogOut,
  ArrowLeft,
  Copy,
  MessageSquare,
  Smile,
  Paperclip,
  Palette,
} from 'lucide-react';
import type {
  FriendListItem,
  GroupMemberItem,
  GroupMessageItem,
  GroupPollItem,
  GroupSummary,
} from '../../types';
import { apiFetch } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';
import {
  CHAT_WALLPAPERS,
  EmojiStickerPicker,
  RankBadges,
  getWallpaperClass,
  isStickerMessage,
} from '../ui/RankBadge';
import { UserProfileModal } from '../profile/UserProfileModal';

interface GroupChatPanelProps {
  friends: FriendListItem[];
  onNotify: (msg: string, tone?: 'success' | 'error' | 'info') => void;
}

function renderWithMentions(text: string) {
  return text.split(/(@[a-zA-Z0-9_.]{3,24})/g).map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="px-1 py-0.5 rounded bg-cbox-violet/20 text-cbox-violet font-semibold">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  );
}

export const GroupChatPanel: React.FC<GroupChatPanelProps> = ({ friends, onNotify }) => {
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [activeGroup, setActiveGroup] = useState<GroupSummary | null>(null);
  const [members, setMembers] = useState<GroupMemberItem[]>([]);
  const [messages, setMessages] = useState<GroupMessageItem[]>([]);
  const [polls, setPolls] = useState<GroupPollItem[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [wallpaperOpen, setWallpaperOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Create group modal
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [joinCode, setJoinCode] = useState('');

  // Create poll modal
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  async function loadGroups() {
    try {
      const res = await apiFetch<{ groups: GroupSummary[] }>('/api/groups');
      setGroups(res.groups);
    } catch {}
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeGroup?.id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onGroupMsg = (msg: GroupMessageItem) => {
      if (activeGroup && msg.groupId === activeGroup.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
      loadGroups();
    };

    const onPollUpdate = (poll: GroupPollItem) => {
      if (activeGroup && poll.groupId === activeGroup.id) {
        setPolls((prev) =>
          prev.some((p) => p.id === poll.id)
            ? prev.map((p) => (p.id === poll.id ? poll : p))
            : [poll, ...prev]
        );
      }
    };

    socket.on('group:message:new', onGroupMsg);
    socket.on('group:poll:update', onPollUpdate);
    return () => {
      socket.off('group:message:new', onGroupMsg);
      socket.off('group:poll:update', onPollUpdate);
    };
  }, [activeGroup?.id]);

  async function openGroup(g: GroupSummary) {
    setActiveGroup(g);
    try {
      const res = await apiFetch<{
        group: GroupSummary;
        members: GroupMemberItem[];
        messages: GroupMessageItem[];
        polls: GroupPollItem[];
      }>(`/api/groups/${g.id}`);
      setActiveGroup({ ...g, wallpaper: res.group.wallpaper || 'default', myRole: res.group.myRole });
      setMembers(res.members || []);
      setMessages(res.messages);
      setPolls(res.polls);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to open group.', 'error');
    }
  }

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch<{ group: GroupSummary }>('/api/groups', {
        method: 'POST',
        body: JSON.stringify({ name: groupName, description: groupDesc, memberIds: selectedFriends }),
      });
      setGroups((prev) => [res.group, ...prev]);
      setCreateOpen(false);
      setGroupName('');
      setGroupDesc('');
      setSelectedFriends([]);
      onNotify(`Group "${res.group.name}" created!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create group.', 'error');
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const res = await apiFetch<{ name: string }>(`/api/groups/join/${encodeURIComponent(joinCode.trim())}`, {
        method: 'POST',
      });
      setJoinCode('');
      await loadGroups();
      onNotify(`Joined group "${res.name}"!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Invalid invite code.', 'error');
    }
  }

  async function sendGroupText(textToSend: string) {
    if (!activeGroup || !textToSend.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<{ message?: GroupMessageItem }>(`/api/groups/${activeGroup.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: textToSend.trim() }),
      });
      if (res.message) {
        const sent = res.message;
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
      setMsgText('');
      setPickerOpen(false);
      loadGroups();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to send message.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleGroupMediaUpload(file: File) {
    if (!activeGroup) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (msgText.trim()) fd.append('caption', msgText.trim());
      const res = await apiFetch<{ message?: GroupMessageItem }>(`/api/groups/${activeGroup.id}/media`, {
        method: 'POST',
        body: fd,
      });
      if (res.message) {
        const sent = res.message;
        setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
      }
      setMsgText('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Group media upload failed.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleSetWallpaper(wpId: string) {
    if (!activeGroup) return;
    try {
      await apiFetch(`/api/groups/${activeGroup.id}/wallpaper`, {
        method: 'PATCH',
        body: JSON.stringify({ wallpaper: wpId }),
      });
      setActiveGroup((prev) => (prev ? { ...prev, wallpaper: wpId } : prev));
      setWallpaperOpen(false);
      onNotify('Group chat background updated!', 'success');
    } catch {}
  }

  async function handleChangeRole(userId: string, role: 'ADMIN' | 'VICE_ADMIN' | 'MEMBER') {
    if (!activeGroup) return;
    try {
      await apiFetch(`/api/groups/${activeGroup.id}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers((prev) => prev.map((m) => (m.user.id === userId ? { ...m, role } : m)));
      onNotify(`Rank updated to ${role.replace('_', ' ')}!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to update rank.', 'error');
    }
  }

  async function handleCreatePoll(e: React.FormEvent) {
    e.preventDefault();
    if (!activeGroup) return;
    const cleanOpts = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (cleanOpts.length < 2) {
      onNotify('Add at least 2 poll options.', 'error');
      return;
    }
    try {
      const res = await apiFetch<{ poll?: GroupPollItem }>(`/api/groups/${activeGroup.id}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question: pollQuestion, options: cleanOpts }),
      });
      if (res.poll) {
        const created = res.poll;
        setPolls((prev) => (prev.some((p) => p.id === created.id) ? prev : [created, ...prev]));
      }
      setPollOpen(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      onNotify('Poll published to group!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create poll.', 'error');
    }
  }

  async function handleVote(pollId: string, optionIndex: number) {
    try {
      const res = await apiFetch<{ poll?: GroupPollItem }>(`/api/groups/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
      if (res.poll) {
        const updated = res.poll;
        setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      }
    } catch {}
  }

  if (activeGroup) {
    return (
      <section className="flex flex-col h-[calc(100dvh-18rem)] min-h-[340px] md:h-[calc(100dvh-11rem)] md:min-h-[480px] rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft">
        <header className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-cbox-border bg-cbox-surface">
          <div className="flex items-center gap-2 min-w-0">
            <button type="button" onClick={() => setActiveGroup(null)} className="p-2 rounded-xl hover:bg-cbox-elevated text-cbox-muted">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h2 className="text-sm font-bold text-cbox-text truncate">{activeGroup.name}</h2>
                <RankBadges groupRank={activeGroup.myRole} />
              </div>
              <p className="text-[11px] text-cbox-muted truncate">{members.length || activeGroup.memberCount} members</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="p-2 rounded-xl border border-cbox-border text-cbox-text hover:bg-cbox-elevated"
              title="Members & Ranks"
            >
              <Users className="h-3.5 w-3.5 text-cbox-accent" />
            </button>
            <button
              type="button"
              onClick={() => setWallpaperOpen(true)}
              className="p-2 rounded-xl border border-cbox-border text-cbox-text hover:bg-cbox-elevated"
              title="Chat Wallpaper"
            >
              <Palette className="h-3.5 w-3.5 text-cbox-violet" />
            </button>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeGroup.inviteCode);
                onNotify(`Invite code copied: ${activeGroup.inviteCode}`, 'success');
              }}
              className="p-2 rounded-xl border border-cbox-border text-cbox-text hover:bg-cbox-elevated"
              title={`Copy Invite: ${activeGroup.inviteCode}`}
            >
              <Copy className="h-3.5 w-3.5 text-cbox-accent" />
            </button>
            <button
              type="button"
              onClick={() => setPollOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-xl bg-cbox-violet/15 text-cbox-violet border border-cbox-violet/30 text-xs font-semibold"
            >
              <BarChart3 className="h-3.5 w-3.5" /> Poll
            </button>
            <button
              type="button"
              onClick={async () => {
                await apiFetch(`/api/groups/${activeGroup.id}/leave`, { method: 'DELETE' });
                setActiveGroup(null);
                await loadGroups();
                onNotify('Left group.', 'info');
              }}
              aria-label="Leave group"
              className="p-2 rounded-xl text-cbox-danger hover:bg-cbox-danger/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className={`flex-1 min-h-0 overflow-y-auto p-4 space-y-4 ${getWallpaperClass(activeGroup.wallpaper)}`}>
          {polls.map((poll) => (
            <div key={poll.id} className="p-4 rounded-2xl border border-cbox-violet/30 bg-cbox-surface space-y-2.5 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-cbox-text flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4 text-cbox-violet" /> {poll.question}
                </span>
                <span className="text-cbox-muted">{poll.totalVotes} vote(s)</span>
              </div>
              <div className="space-y-1.5">
                {poll.options.map((opt, idx) => {
                  const pct = poll.totalVotes > 0 ? Math.round((poll.counts[idx] / poll.totalVotes) * 100) : 0;
                  const chosen = poll.myVote === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleVote(poll.id, idx)}
                      className={`relative w-full overflow-hidden rounded-xl border px-3 py-2 text-left text-xs transition ${
                        chosen ? 'border-cbox-accent font-semibold' : 'border-cbox-border'
                      }`}
                    >
                      <div className="absolute inset-y-0 left-0 bg-cbox-accent/20 transition-all duration-300" style={{ width: `${pct}%` }} />
                      <div className="relative flex justify-between text-cbox-text">
                        <span>{opt}</span>
                        <span>{pct}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {messages.length === 0 && polls.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4 space-y-2">
              <div className="h-11 w-11 rounded-2xl bg-cbox-accent/15 text-cbox-accent flex items-center justify-center">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="text-sm font-semibold text-cbox-text">Welcome to {activeGroup.name}</p>
              <p className="text-xs text-cbox-muted max-w-xs">
                Send a message, sticker, photo, or short video below!
              </p>
            </div>
          )}

          {messages.map((m) => {
            const sticker = isStickerMessage(m.content);
            return (
              <div key={m.id} className="flex items-start gap-2.5">
                <button type="button" onClick={() => setProfileUsername(m.sender.username)} className="shrink-0">
                  <Avatar src={m.sender.avatarUrl} name={m.sender.primaryNickname} size="sm" />
                </button>
                <div className="min-w-0 max-w-[85%] bg-cbox-surface/95 border border-cbox-border rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
                  <div className="flex items-center gap-1.5 flex-wrap text-xs">
                    <button type="button" onClick={() => setProfileUsername(m.sender.username)} className="font-bold text-cbox-accent hover:underline">
                      {m.sender.primaryNickname}
                    </button>
                    <RankBadges userRole={m.sender.role} groupRank={m.senderRole} isVerified={m.sender.isVerified} />
                    <span className="text-cbox-muted text-[10px]">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {m.mediaUrl && m.mediaKind === 'IMAGE' && (
                    <img src={m.mediaUrl} alt="Group photo" className="mt-1.5 rounded-xl max-h-60 object-cover" />
                  )}
                  {m.mediaUrl && m.mediaKind === 'VIDEO' && (
                    <video src={m.mediaUrl} controls className="mt-1.5 rounded-xl max-h-60 w-full" />
                  )}
                  {m.mediaUrl && m.mediaKind === 'AUDIO' && (
                    <audio src={m.mediaUrl} controls className="mt-1.5 max-w-full" />
                  )}

                  {sticker ? (
                    <div className="mt-1.5 inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-gradient-to-r from-cbox-accent/20 to-cbox-violet/20 border border-cbox-accent/30">
                      <span className="text-2xl">{sticker.emoji}</span>
                      <span className="text-xs font-extrabold text-cbox-text">{sticker.label}</span>
                    </div>
                  ) : (
                    m.content && <p className="text-cbox-text mt-0.5 break-words">{renderWithMentions(m.content)}</p>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="relative shrink-0 border-t border-cbox-border bg-cbox-surface p-2.5">
          {pickerOpen && (
            <div className="absolute bottom-14 left-2 z-30">
              <EmojiStickerPicker
                onPickEmoji={(em) => setMsgText((p) => p + em)}
                onPickSticker={(st) => sendGroupText(st)}
              />
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendGroupText(msgText);
            }}
            className="flex items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => setPickerOpen((v) => !v)}
              className="p-2 rounded-xl text-cbox-muted hover:text-cbox-accent"
              title="Emojis & Stickers"
            >
              <Smile className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/mp4,video/webm,video/quicktime,audio/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleGroupMediaUpload(f);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 rounded-xl text-cbox-muted hover:text-cbox-accent"
              title="Photo or Short Video (max 10 MB)"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <input
              type="text"
              value={msgText}
              onChange={(e) => setMsgText(e.target.value)}
              placeholder="Message group… (@mention)"
              className="flex-1 min-w-0 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text focus:outline-none focus:border-cbox-accent"
            />
            <button
              type="submit"
              disabled={!msgText.trim() || sending}
              aria-label="Send group message"
              className="h-9 w-9 shrink-0 rounded-xl bg-cbox-accent text-slate-950 flex items-center justify-center disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Group Members & Rank Management Modal */}
        <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`${activeGroup.name} Ranks`}>
          <div className="divide-y divide-cbox-border text-xs max-h-72 overflow-y-auto">
            {members.map((m) => (
              <div key={m.user.id} className="py-2.5 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMembersOpen(false);
                    setProfileUsername(m.user.username);
                  }}
                  className="flex items-center gap-2 text-left min-w-0"
                >
                  <Avatar src={m.user.avatarUrl} name={m.user.primaryNickname} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-cbox-text truncate">{m.user.primaryNickname}</span>
                      <RankBadges userRole={m.user.role} groupRank={m.role} isVerified={m.user.isVerified} />
                    </div>
                    <p className="text-[11px] text-cbox-muted">@{m.user.username}</p>
                  </div>
                </button>
                {activeGroup.myRole === 'OWNER' && m.role !== 'OWNER' && (
                  <select
                    value={m.role}
                    onChange={(e) => handleChangeRole(m.user.id, e.target.value as 'ADMIN' | 'VICE_ADMIN' | 'MEMBER')}
                    className="rounded-lg bg-cbox-elevated border border-cbox-border px-2 py-1 text-[11px] text-cbox-text"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="VICE_ADMIN">Vice Admin</option>
                    <option value="MEMBER">Member</option>
                  </select>
                )}
              </div>
            ))}
          </div>
        </Modal>

        {/* Wallpaper Picker Modal */}
        <Modal open={wallpaperOpen} onClose={() => setWallpaperOpen(false)} title="Group Chat Background">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CHAT_WALLPAPERS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSetWallpaper(w.id)}
                className={`p-2 rounded-xl border text-center space-y-1.5 ${
                  activeGroup.wallpaper === w.id ? 'border-cbox-accent ring-1 ring-cbox-accent' : 'border-cbox-border'
                }`}
              >
                <div className="h-10 rounded-lg" style={{ background: w.preview }} />
                <p className="text-[11px] font-semibold text-cbox-text">{w.name}</p>
              </button>
            ))}
          </div>
        </Modal>

        <Modal open={pollOpen} onClose={() => setPollOpen(false)} title="Create Live Poll" maxWidthClass="max-w-md">
          <form onSubmit={handleCreatePoll} className="space-y-3">
            <input type="text" required value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} placeholder="Ask a question…" className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text" />
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                required
                value={opt}
                onChange={(e) => setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))}
                placeholder={`Option ${idx + 1}`}
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            ))}
            {pollOptions.length < 5 && (
              <button type="button" onClick={() => setPollOptions((p) => [...p, ''])} className="text-xs text-cbox-accent font-semibold hover:underline">
                + Add option
              </button>
            )}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-cbox-violet text-white font-semibold text-sm">
              Publish Poll
            </button>
          </form>
        </Modal>

        <UserProfileModal username={profileUsername} onClose={() => setProfileUsername(null)} onNotify={onNotify} />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-xs">
          <Plus className="h-4 w-4" /> New Group
        </button>

        <form onSubmit={handleJoinByCode} className="flex-1 flex gap-1.5 min-w-[200px]">
          <input type="text" value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="Join via invite code…" className="flex-1 min-w-0 rounded-xl bg-cbox-surface border border-cbox-border px-3 py-1.5 text-xs text-cbox-text" />
          <button type="submit" disabled={!joinCode.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text hover:bg-cbox-elevated disabled:opacity-40">
            <Link2 className="h-3.5 w-3.5" /> Join
          </button>
        </form>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No groups yet"
          description="Create a group with friends or paste an invite code to join."
        />
      ) : (
        <div className="space-y-2.5">
          {groups.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => openGroup(g)}
              className="w-full p-3.5 rounded-xl border border-cbox-border bg-cbox-surface hover:bg-cbox-elevated/60 flex items-center justify-between gap-3 text-left transition"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-cbox-text truncate">{g.name}</p>
                <p className="text-xs text-cbox-muted truncate">
                  {g.lastMessage
                    ? `${g.lastMessage.senderName}: ${g.lastMessage.content}`
                    : `${g.memberCount} members · Invite: ${g.inviteCode}`}
                </p>
              </div>
              <RankBadges groupRank={g.myRole} />
            </button>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Group Chat" maxWidthClass="max-w-md">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <input type="text" required value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name (e.g. College Squad)" className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text" />
          <input type="text" value={groupDesc} onChange={(e) => setGroupDesc(e.target.value)} placeholder="Short description (optional)" className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text" />
          {friends.length > 0 && (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              <span className="text-xs font-medium text-cbox-muted">Add Friends:</span>
              {friends.map((f) => {
                const checked = selectedFriends.includes(f.friend.id);
                return (
                  <label key={f.friend.id} className="flex items-center gap-2 text-xs text-cbox-text cursor-pointer py-1">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelectedFriends((prev) =>
                          checked ? prev.filter((id) => id !== f.friend.id) : [...prev, f.friend.id]
                        )
                      }
                      className="accent-cbox-accent"
                    />
                    <span>{f.friend.primaryNickname} (@{f.friend.username})</span>
                  </label>
                );
              })}
            </div>
          )}
          <button type="submit" className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm">
            Create Group
          </button>
        </form>
      </Modal>
    </div>
  );
};
