import React, { useEffect, useState } from 'react';
import {
  Users,
  Plus,
  Link2,
  BarChart3,
  Send,
  LogOut,
  ArrowLeft,
  Copy,
} from 'lucide-react';
import type { FriendListItem, GroupMessageItem, GroupPollItem, GroupSummary } from '../../types';
import { apiFetch } from '../../lib/api';
import { getSocket } from '../../lib/socket';
import { Modal } from '../ui/Modal';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';

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
  const [messages, setMessages] = useState<GroupMessageItem[]>([]);
  const [polls, setPolls] = useState<GroupPollItem[]>([]);
  const [msgText, setMsgText] = useState('');

  // Create group modal
  const [createOpen, setCreateOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);

  // Join via invite code
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
        messages: GroupMessageItem[];
        polls: GroupPollItem[];
      }>(`/api/groups/${g.id}`);
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

  async function handleSendGroupMsg(e: React.FormEvent) {
    e.preventDefault();
    if (!activeGroup || !msgText.trim()) return;
    const text = msgText.trim();
    setMsgText('');
    try {
      await apiFetch(`/api/groups/${activeGroup.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to send message.', 'error');
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
      await apiFetch(`/api/groups/${activeGroup.id}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question: pollQuestion, options: cleanOpts }),
      });
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
      await apiFetch(`/api/groups/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
    } catch {}
  }

  if (activeGroup) {
    return (
      <section className="flex flex-col h-[calc(100dvh-11rem)] md:h-[calc(100dvh-5rem)] rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft animate-fade-slide">
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-cbox-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveGroup(null)}
              className="p-2 rounded-xl hover:bg-cbox-elevated text-cbox-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-cbox-text truncate">{activeGroup.name}</h2>
              <p className="text-[11px] text-cbox-muted truncate">
                {activeGroup.memberCount} members · Role: {activeGroup.myRole}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeGroup.inviteCode);
                onNotify(`Invite code copied: ${activeGroup.inviteCode}`, 'success');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cbox-border text-xs text-cbox-text hover:bg-cbox-elevated"
            >
              <Copy className="h-3.5 w-3.5 text-cbox-accent" />
              <span className="hidden sm:inline">Invite:</span> {activeGroup.inviteCode}
            </button>
            <button
              type="button"
              onClick={() => setPollOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cbox-violet/15 text-cbox-violet border border-cbox-violet/30 text-xs font-semibold"
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

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-cbox-bg/40">
          {/* Active Polls */}
          {polls.map((poll) => (
            <div
              key={poll.id}
              className="p-4 rounded-2xl border border-cbox-violet/30 bg-cbox-surface space-y-2.5 shadow-sm"
            >
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
                      <div
                        className="absolute inset-y-0 left-0 bg-cbox-accent/20 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
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

          {/* Group Messages */}
          {messages.map((m) => (
            <div key={m.id} className="flex items-start gap-2.5">
              <Avatar src={m.sender.avatarUrl} name={m.sender.primaryNickname} size="sm" />
              <div className="min-w-0 bg-cbox-surface border border-cbox-border rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-cbox-accent">{m.sender.primaryNickname}</span>
                  <span className="text-cbox-muted text-[10px]">
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-cbox-text mt-0.5 break-words">{renderWithMentions(m.content)}</p>
              </div>
            </div>
          ))}
        </div>

        <form onSubmit={handleSendGroupMsg} className="flex gap-2 p-3 border-t border-cbox-border bg-cbox-surface">
          <input
            type="text"
            value={msgText}
            onChange={(e) => setMsgText(e.target.value)}
            placeholder="Message group… (use @username to mention)"
            className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2.5 text-base sm:text-sm text-cbox-text"
          />
          <button
            type="submit"
            disabled={!msgText.trim()}
            className="h-10 w-10 rounded-xl bg-cbox-accent text-slate-950 flex items-center justify-center disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        <Modal open={pollOpen} onClose={() => setPollOpen(false)} title="Create Live Poll" maxWidthClass="max-w-md">
          <form onSubmit={handleCreatePoll} className="space-y-3">
            <input
              type="text"
              required
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question…"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            {pollOptions.map((opt, idx) => (
              <input
                key={idx}
                type="text"
                required
                value={opt}
                onChange={(e) =>
                  setPollOptions((prev) => prev.map((v, i) => (i === idx ? e.target.value : v)))
                }
                placeholder={`Option ${idx + 1}`}
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            ))}
            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() => setPollOptions((p) => [...p, ''])}
                className="text-xs text-cbox-accent font-semibold hover:underline"
              >
                + Add option
              </button>
            )}
            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-cbox-violet text-white font-semibold text-sm"
            >
              Publish Poll
            </button>
          </form>
        </Modal>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-xs"
        >
          <Plus className="h-4 w-4" /> New Group
        </button>

        <form onSubmit={handleJoinByCode} className="flex-1 flex gap-1.5 min-w-[200px]">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Join via invite code…"
            className="flex-1 min-w-0 rounded-xl bg-cbox-surface border border-cbox-border px-3 py-1.5 text-xs text-cbox-text"
          />
          <button
            type="submit"
            disabled={!joinCode.trim()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text hover:bg-cbox-elevated disabled:opacity-40"
          >
            <Link2 className="h-3.5 w-3.5" /> Join
          </button>
        </form>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No groups yet"
          description="Create a group with friends or paste an invite code to join a community with live polls and @mentions."
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
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cbox-elevated border border-cbox-border text-cbox-muted">
                {g.myRole}
              </span>
            </button>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Group Chat" maxWidthClass="max-w-md">
        <form onSubmit={handleCreateGroup} className="space-y-4">
          <input
            type="text"
            required
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name (e.g. College Squad)"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />
          <input
            type="text"
            value={groupDesc}
            onChange={(e) => setGroupDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />
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
          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-semibold text-sm"
          >
            Create Group
          </button>
        </form>
      </Modal>
    </div>
  );
};
