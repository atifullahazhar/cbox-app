import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Copy,
  Hash,
  Link2,
  LogOut,
  Mic,
  MicOff,
  Paperclip,
  PhoneOff,
  Plus,
  Send,
  Smile,
  Users,
  Volume2,
} from 'lucide-react';
import type {
  CommunityChannel,
  CommunityMember,
  CommunityMessage,
  CommunitySummary,
  GroupRank,
  SafeUser,
} from '../types';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import {
  EmojiStickerPicker,
  RankBadges,
  isStickerMessage,
} from '../components/ui/RankBadge';
import { UserProfileModal } from '../components/profile/UserProfileModal';

interface CommunitiesScreenProps {
  currentUser: SafeUser;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

interface VcPeer {
  userId: string;
  username: string;
  nickname: string;
  muted: boolean;
}

const BANNERS = [
  'from-sky-600 to-indigo-900',
  'from-pink-600 to-rose-900',
  'from-emerald-600 to-teal-950',
  'from-violet-600 to-fuchsia-900',
  'from-amber-600 to-orange-950',
];

export const CommunitiesScreen: React.FC<CommunitiesScreenProps> = ({ currentUser, onNotify }) => {
  const [joined, setJoined] = useState<CommunitySummary[]>([]);
  const [discover, setDiscover] = useState<CommunitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');

  // Create Community Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newEmoji, setNewEmoji] = useState('🎮');
  const [newBanner, setNewBanner] = useState(BANNERS[0]);
  const [newPublic, setNewPublic] = useState(true);

  // Active Community Workspace
  const [activeComm, setActiveComm] = useState<CommunitySummary | null>(null);
  const [channels, setChannels] = useState<CommunityChannel[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [activeChannel, setActiveChannel] = useState<CommunityChannel | null>(null);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [msgText, setMsgText] = useState('');
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const msgEndRef = useRef<HTMLDivElement | null>(null);

  // Create Channel Modal (Owner / Admin)
  const [addChannelOpen, setAddChannelOpen] = useState(false);
  const [chName, setChName] = useState('');
  const [chType, setChType] = useState<'TEXT' | 'VOICE'>('TEXT');
  const [chTopic, setChTopic] = useState('');

  // Live Voice Channel (VC) State
  const [activeVc, setActiveVc] = useState<CommunityChannel | null>(null);
  const [vcPeers, setVcPeers] = useState<VcPeer[]>([]);
  const [vcMuted, setVcMuted] = useState(false);
  const vcStreamRef = useRef<MediaStream | null>(null);

  async function loadDirectory() {
    setLoading(true);
    try {
      const res = await apiFetch<{ joined: CommunitySummary[]; discover: CommunitySummary[] }>('/api/communities');
      setJoined(res.joined);
      setDiscover(res.discover);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load communities.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDirectory();
  }, []);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, activeChannel?.id]);

  // Socket.IO realtime messages + live VC participants
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMsg = (msg: CommunityMessage) => {
      if (activeChannel && msg.channelId === activeChannel.id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      }
    };

    const onVcParticipants = (data: { channelId: string; participants: VcPeer[] }) => {
      if (activeVc && data.channelId === activeVc.id) {
        setVcPeers(data.participants);
      }
    };

    socket.on('community:message:new', onNewMsg);
    socket.on('vc:participants', onVcParticipants);
    return () => {
      socket.off('community:message:new', onNewMsg);
      socket.off('vc:participants', onVcParticipants);
    };
  }, [activeChannel?.id, activeVc?.id]);

  async function openCommunity(c: CommunitySummary) {
    try {
      const res = await apiFetch<{
        community: CommunitySummary;
        channels: CommunityChannel[];
        members: CommunityMember[];
      }>(`/api/communities/${c.id}`);
      setActiveComm(res.community);
      setChannels(res.channels);
      setMembers(res.members);
      const firstText = res.channels.find((ch) => ch.type === 'TEXT') || null;
      setActiveChannel(firstText);
      if (firstText) loadChannelMessages(c.id, firstText.id);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to open community.', 'error');
    }
  }

  async function loadChannelMessages(commId: string, channelId: string) {
    try {
      const res = await apiFetch<{ messages: CommunityMessage[] }>(
        `/api/communities/${commId}/channels/${channelId}/messages`
      );
      setMessages(res.messages);
    } catch {}
  }

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await apiFetch<{ community: CommunitySummary }>('/api/communities', {
        method: 'POST',
        body: JSON.stringify({
          name: newName,
          description: newDesc,
          iconEmoji: newEmoji || '🌐',
          bannerGradient: newBanner,
          isPublic: newPublic,
        }),
      });
      setCreateOpen(false);
      setNewName('');
      setNewDesc('');
      await loadDirectory();
      openCommunity(res.community);
      onNotify(`Community "${res.community.name}" created with Text & Voice channels!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create community.', 'error');
    }
  }

  async function handleJoinByCode(e: React.FormEvent) {
    e.preventDefault();
    if (!joinCode.trim()) return;
    try {
      const res = await apiFetch<{ name: string }>(`/api/communities/join/${encodeURIComponent(joinCode.trim())}`, {
        method: 'POST',
      });
      setJoinCode('');
      await loadDirectory();
      onNotify(`Joined "${res.name}"!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Invalid invite code.', 'error');
    }
  }

  async function handleJoinPublic(c: CommunitySummary) {
    try {
      await apiFetch(`/api/communities/${c.id}/join`, { method: 'POST' });
      await loadDirectory();
      openCommunity({ ...c, myRole: 'MEMBER' });
      onNotify(`Joined "${c.name}"!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Unable to join.', 'error');
    }
  }

  async function sendChannelText(textToSend: string) {
    if (!activeComm || !activeChannel || !textToSend.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch<{ message: CommunityMessage }>(
        `/api/communities/${activeComm.id}/channels/${activeChannel.id}/messages`,
        {
          method: 'POST',
          body: JSON.stringify({ content: textToSend.trim() }),
        }
      );
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setMsgText('');
      setPickerOpen(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Message failed.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleUploadChannelMedia(file: File) {
    if (!activeComm || !activeChannel) return;
    setSending(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (msgText.trim()) fd.append('content', msgText.trim());
      const res = await apiFetch<{ message: CommunityMessage }>(
        `/api/communities/${activeComm.id}/channels/${activeChannel.id}/messages`,
        { method: 'POST', body: fd }
      );
      setMessages((prev) => (prev.some((m) => m.id === res.message.id) ? prev : [...prev, res.message]));
      setMsgText('');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally {
      setSending(false);
    }
  }

  async function handleCreateChannel(e: React.FormEvent) {
    e.preventDefault();
    if (!activeComm || !chName.trim()) return;
    try {
      const res = await apiFetch<{ channel: CommunityChannel }>(`/api/communities/${activeComm.id}/channels`, {
        method: 'POST',
        body: JSON.stringify({ name: chName.trim(), type: chType, topic: chTopic.trim() }),
      });
      setChannels((prev) => [...prev, res.channel]);
      setAddChannelOpen(false);
      setChName('');
      setChTopic('');
      onNotify(`Channel #${res.channel.name} created!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to create channel.', 'error');
    }
  }

  async function handleChangeMemberRole(userId: string, role: 'ADMIN' | 'VICE_ADMIN' | 'MEMBER') {
    if (!activeComm) return;
    try {
      await apiFetch(`/api/communities/${activeComm.id}/members/${userId}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setMembers((prev) => prev.map((m) => (m.user.id === userId ? { ...m, role } : m)));
      onNotify(`Updated member rank to ${role.replace('_', ' ')}!`, 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Role update failed.', 'error');
    }
  }

  async function joinVoiceChannel(vc: CommunityChannel) {
    const socket = getSocket();
    if (!socket) return;
    if (activeVc?.id === vc.id) return;
    if (activeVc) leaveVoiceChannel();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      vcStreamRef.current = stream;
    } catch {
      // Allow listening in VC even if mic permission denied
    }
    setActiveVc(vc);
    setVcMuted(false);
    socket.emit('vc:join', { channelId: vc.id });
    onNotify(`Connected to Voice Channel: ${vc.name}`, 'success');
  }

  function leaveVoiceChannel() {
    const socket = getSocket();
    if (activeVc && socket) socket.emit('vc:leave', { channelId: activeVc.id });
    vcStreamRef.current?.getTracks().forEach((t) => t.stop());
    vcStreamRef.current = null;
    setActiveVc(null);
    setVcPeers([]);
  }

  function toggleVcMute() {
    const next = !vcMuted;
    setVcMuted(next);
    vcStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
    if (activeVc) getSocket()?.emit('vc:mute', { channelId: activeVc.id, muted: next });
  }

  // ===================== ACTIVE DISCORD-STYLE COMMUNITY WORKSPACE =====================
  if (activeComm) {
    const textChannels = channels.filter((c) => c.type === 'TEXT');
    const voiceChannels = channels.filter((c) => c.type === 'VOICE');
    const canManageChannels = activeComm.myRole === 'OWNER' || activeComm.myRole === 'ADMIN';

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-cbox-border bg-cbox-surface px-4 py-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => {
                leaveVoiceChannel();
                setActiveComm(null);
              }}
              className="p-2 rounded-xl hover:bg-cbox-elevated text-cbox-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="text-xl">{activeComm.iconEmoji}</span>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-cbox-text truncate">{activeComm.name}</h1>
              <p className="text-[11px] text-cbox-muted truncate">{members.length} members · Invite: {activeComm.inviteCode}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(activeComm.inviteCode);
                onNotify(`Invite code copied: ${activeComm.inviteCode}`, 'success');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-cbox-border text-xs text-cbox-text"
            >
              <Copy className="h-3.5 w-3.5 text-cbox-accent" /> Copy Code
            </button>
            <button
              type="button"
              onClick={() => setMembersOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cbox-elevated border border-cbox-border text-xs font-semibold text-cbox-text"
            >
              <Users className="h-3.5 w-3.5 text-cbox-violet" /> Members
            </button>
            <button
              type="button"
              onClick={async () => {
                leaveVoiceChannel();
                await apiFetch(`/api/communities/${activeComm.id}/leave`, { method: 'DELETE' });
                setActiveComm(null);
                loadDirectory();
                onNotify('Left community.', 'info');
              }}
              className="p-2 rounded-xl text-cbox-danger hover:bg-cbox-danger/10"
              aria-label="Leave community"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Discord-style 2-Pane Layout: Channels Sidebar + Active Text/VC Feed */}
        <div className="grid md:grid-cols-[220px_1fr] gap-3">
          {/* Channels Sidebar */}
          <aside className="rounded-2xl border border-cbox-border bg-cbox-surface p-3 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cbox-muted">Text Channels</span>
                {canManageChannels && (
                  <button
                    type="button"
                    onClick={() => {
                      setChType('TEXT');
                      setAddChannelOpen(true);
                    }}
                    className="text-cbox-accent hover:opacity-80"
                    title="Add Channel"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {textChannels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => {
                    setActiveChannel(ch);
                    loadChannelMessages(activeComm.id, ch.id);
                  }}
                  className={`w-full flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                    activeChannel?.id === ch.id
                      ? 'bg-cbox-accent/15 text-cbox-accent'
                      : 'text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated/60'
                  }`}
                >
                  <Hash className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{ch.name}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-2 border-t border-cbox-border">
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-cbox-muted">Voice Channels (VC)</span>
                {canManageChannels && (
                  <button
                    type="button"
                    onClick={() => {
                      setChType('VOICE');
                      setAddChannelOpen(true);
                    }}
                    className="text-cbox-violet hover:opacity-80"
                    title="Add Voice Channel"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              {voiceChannels.map((vc) => {
                const connected = activeVc?.id === vc.id;
                return (
                  <button
                    key={vc.id}
                    type="button"
                    onClick={() => joinVoiceChannel(vc)}
                    className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition ${
                      connected
                        ? 'bg-cbox-success/15 text-cbox-success border border-cbox-success/30'
                        : 'text-cbox-muted hover:text-cbox-text hover:bg-cbox-elevated/60'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Volume2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{vc.name}</span>
                    </span>
                    {connected && <span className="text-[10px] font-bold">LIVE</span>}
                  </button>
                );
              })}
            </div>

            {/* Active VC Control Strip */}
            {activeVc && (
              <div className="p-2.5 rounded-xl bg-cbox-success/10 border border-cbox-success/30 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cbox-success truncate">🔊 {activeVc.name}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={toggleVcMute} className="p-1.5 rounded-lg bg-cbox-surface border border-cbox-border">
                      {vcMuted ? <MicOff className="h-3.5 w-3.5 text-cbox-danger" /> : <Mic className="h-3.5 w-3.5 text-cbox-success" />}
                    </button>
                    <button type="button" onClick={leaveVoiceChannel} className="p-1.5 rounded-lg bg-cbox-danger/20 text-cbox-danger">
                      <PhoneOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  {vcPeers.map((p) => (
                    <div key={p.userId} className="flex items-center justify-between text-[11px] text-cbox-text">
                      <span className="truncate">{p.nickname}</span>
                      <span>{p.muted ? '🔇' : '🎙️'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>

          {/* Active Text Channel Chat */}
          <section className="flex flex-col h-[calc(100dvh-19rem)] min-h-[360px] md:h-[calc(100dvh-11rem)] rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden">
            <header className="shrink-0 px-4 py-2.5 border-b border-cbox-border flex items-center justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-cbox-text flex items-center gap-1">
                  <Hash className="h-4 w-4 text-cbox-accent" /> {activeChannel?.name || 'general'}
                </h2>
                {activeChannel?.topic && <p className="text-[11px] text-cbox-muted truncate">{activeChannel.topic}</p>}
              </div>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 bg-cbox-bg/40">
              {messages.length === 0 ? (
                <p className="text-xs text-cbox-muted text-center py-10">
                  No messages in #{activeChannel?.name} yet — start the conversation!
                </p>
              ) : (
                messages.map((m) => {
                  const sticker = isStickerMessage(m.content);
                  return (
                    <div key={m.id} className="flex items-start gap-2.5">
                      <button type="button" onClick={() => setProfileUsername(m.sender.username)} className="shrink-0">
                        <Avatar src={m.sender.avatarUrl} name={m.sender.primaryNickname} size="sm" />
                      </button>
                      <div className="min-w-0 max-w-[85%] bg-cbox-surface border border-cbox-border rounded-2xl rounded-tl-sm px-3.5 py-2 text-sm">
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <button
                            type="button"
                            onClick={() => setProfileUsername(m.sender.username)}
                            className="font-bold text-cbox-text hover:text-cbox-accent"
                          >
                            {m.sender.primaryNickname}
                          </button>
                          <RankBadges
                            userRole={m.sender.role}
                            groupRank={m.senderRole}
                            isVerified={m.sender.isVerified}
                          />
                          <span className="text-[10px] text-cbox-muted">
                            {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {m.mediaUrl && m.mediaKind === 'IMAGE' && (
                          <img src={m.mediaUrl} alt="Attachment" className="mt-1.5 rounded-xl max-h-60 object-cover" />
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
                          m.content && <p className="text-cbox-text mt-1 break-words">{m.content}</p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={msgEndRef} />
            </div>

            <div className="relative shrink-0 border-t border-cbox-border bg-cbox-surface p-2.5">
              {pickerOpen && (
                <div className="absolute bottom-14 left-2 z-30">
                  <EmojiStickerPicker
                    onPickEmoji={(em) => setMsgText((p) => p + em)}
                    onPickSticker={(st) => sendChannelText(st)}
                  />
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChannelText(msgText);
                }}
                className="flex items-center gap-1.5"
              >
                <button
                  type="button"
                  onClick={() => setPickerOpen((v) => !v)}
                  className="p-2 rounded-xl text-cbox-muted hover:text-cbox-accent hover:bg-cbox-elevated"
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
                    if (f) handleUploadChannelMedia(f);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-cbox-muted hover:text-cbox-accent hover:bg-cbox-elevated"
                  title="Upload Photo or Short Video (max 10 MB)"
                >
                  <Paperclip className="h-4 w-4" />
                </button>
                <input
                  type="text"
                  value={msgText}
                  onChange={(e) => setMsgText(e.target.value)}
                  placeholder={`Message #${activeChannel?.name || 'channel'}…`}
                  className="flex-1 min-w-0 rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
                />
                <button
                  type="submit"
                  disabled={!msgText.trim() || sending}
                  className="h-9 w-9 shrink-0 rounded-xl bg-cbox-accent text-slate-950 flex items-center justify-center disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Members & Ranks Modal */}
        <Modal open={membersOpen} onClose={() => setMembersOpen(false)} title={`${activeComm.name} Members (${members.length})`}>
          <div className="divide-y divide-cbox-border text-xs max-h-80 overflow-y-auto">
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
                  <Avatar src={m.user.avatarUrl} name={m.user.primaryNickname} size="sm" online={m.online} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-bold text-cbox-text truncate">{m.user.primaryNickname}</span>
                      <RankBadges userRole={m.user.role} groupRank={m.role} isVerified={m.user.isVerified} />
                    </div>
                    <p className="text-[11px] text-cbox-muted">@{m.user.username}</p>
                  </div>
                </button>

                {activeComm.myRole === 'OWNER' && m.user.id !== currentUser.id && (
                  <select
                    value={m.role}
                    onChange={(e) => handleChangeMemberRole(m.user.id, e.target.value as 'ADMIN' | 'VICE_ADMIN' | 'MEMBER')}
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

        {/* Create Channel Modal */}
        <Modal open={addChannelOpen} onClose={() => setAddChannelOpen(false)} title="Create Community Channel">
          <form onSubmit={handleCreateChannel} className="space-y-3">
            <select
              value={chType}
              onChange={(e) => setChType(e.target.value as 'TEXT' | 'VOICE')}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-xs text-cbox-text"
            >
              <option value="TEXT">Text Channel (#chat)</option>
              <option value="VOICE">Voice Channel (🔊 VC)</option>
            </select>
            <input
              type="text"
              required
              value={chName}
              onChange={(e) => setChName(e.target.value)}
              placeholder={chType === 'TEXT' ? 'e.g. minecraft-builds' : 'e.g. Chill Music VC'}
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            <input
              type="text"
              value={chTopic}
              onChange={(e) => setChTopic(e.target.value)}
              placeholder="Channel topic (optional)"
              className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
            <button type="submit" className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs">
              Create Channel
            </button>
          </form>
        </Modal>

        <UserProfileModal
          username={profileUsername}
          onClose={() => setProfileUsername(null)}
          onNotify={onNotify}
        />
      </div>
    );
  }

  // ===================== COMMUNITIES DIRECTORY =====================
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 shadow-soft flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-cbox-text flex items-center gap-2">
            <Compass className="h-5 w-5 text-cbox-accent" /> Communities
          </h1>
          <p className="text-xs text-cbox-muted">
            Discord-style hubs with Text channels, live Voice Channels (VC), and Owner/Admin/Vice Admin ranks.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs"
        >
          <Plus className="h-4 w-4" /> Create Community
        </button>
      </div>

      <form onSubmit={handleJoinByCode} className="flex gap-2">
        <input
          type="text"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          placeholder="Join private or public community via invite code…"
          className="flex-1 rounded-xl bg-cbox-surface border border-cbox-border px-3.5 py-2 text-xs text-cbox-text"
        />
        <button type="submit" disabled={!joinCode.trim()} className="inline-flex items-center gap-1 px-4 py-2 rounded-xl border border-cbox-border text-xs font-bold text-cbox-text disabled:opacity-40">
          <Link2 className="h-3.5 w-3.5" /> Join
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton variant="card" rows={2} />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-cbox-muted">Your Communities ({joined.length})</h2>
            {joined.length === 0 ? (
              <EmptyState
                icon={<Compass className="h-6 w-6" />}
                title="No communities joined yet"
                description="Create your own community hub or join one below!"
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {joined.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openCommunity(c)}
                    className="rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden text-left hover:border-cbox-accent transition"
                  >
                    <div className={`bg-gradient-to-r ${c.bannerGradient} p-4 text-white flex items-center justify-between`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-2xl">{c.iconEmoji}</span>
                        <div className="min-w-0">
                          <p className="font-bold text-sm truncate">{c.name}</p>
                          <p className="text-[11px] text-white/80">{c.memberCount} members · {c.channelCount} channels</p>
                        </div>
                      </div>
                      {c.myRole && <RankBadges groupRank={c.myRole as GroupRank} />}
                    </div>
                    {c.description && <p className="p-3 text-xs text-cbox-muted truncate">{c.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </section>

          {discover.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-cbox-muted">Discover Public Communities</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {discover.map((c) => (
                  <div key={c.id} className="rounded-2xl border border-cbox-border bg-cbox-surface p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl">{c.iconEmoji}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-cbox-text truncate">{c.name}</p>
                        <p className="text-xs text-cbox-muted truncate">{c.description || `${c.memberCount} members`}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleJoinPublic(c)}
                      className="px-3.5 py-1.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs shrink-0"
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Create Community Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create a Community">
        <form onSubmit={handleCreateCommunity} className="space-y-3.5">
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={4}
              value={newEmoji}
              onChange={(e) => setNewEmoji(e.target.value)}
              className="w-16 text-center text-xl rounded-xl bg-cbox-elevated border border-cbox-border py-2"
            />
            <input
              type="text"
              required
              minLength={2}
              maxLength={64}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Community name (e.g. Minecraft India)"
              className="flex-1 rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
            />
          </div>
          <textarea
            rows={2}
            maxLength={300}
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="What is this community about?"
            className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
          />
          <label className="flex items-center justify-between text-xs text-cbox-text">
            <span>Public (Anyone can discover &amp; join)</span>
            <input type="checkbox" checked={newPublic} onChange={(e) => setNewPublic(e.target.checked)} className="h-4 w-4 accent-cbox-accent" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {BANNERS.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setNewBanner(b)}
                className={`h-7 w-12 rounded-lg bg-gradient-to-r ${b} ${newBanner === b ? 'ring-2 ring-cbox-accent' : 'opacity-70'}`}
              />
            ))}
          </div>
          <button type="submit" className="w-full py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs">
            Launch Community
          </button>
        </form>
      </Modal>
    </div>
  );
};
