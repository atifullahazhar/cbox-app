import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  MapPin,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Users,
} from 'lucide-react';
import type { EventItem, SafeUser } from '../types';
import { apiFetch } from '../lib/api';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { LoadingSkeleton } from '../components/ui/LoadingSkeleton';
import { EmptyState } from '../components/ui/EmptyState';

interface EventsScreenProps {
  currentUser: SafeUser;
  onNotify: (message: string, tone?: 'success' | 'error' | 'info') => void;
}

const CATEGORIES = ['All', 'Meetup', 'Gaming', 'Music', 'Tech', 'Art', 'Watch Party'];
const GRADIENTS = [
  { id: 'from-sky-600 to-indigo-900', label: 'Ocean Indigo' },
  { id: 'from-pink-600 to-rose-900', label: 'Sakura Rose' },
  { id: 'from-emerald-600 to-teal-950', label: 'Emerald Pulse' },
  { id: 'from-violet-600 to-fuchsia-900', label: 'Cyber Violet' },
  { id: 'from-amber-600 to-orange-950', label: 'Sunset Gold' },
];

function formatCountdown(isoDate: string): string {
  const diffMs = new Date(isoDate).getTime() - Date.now();
  if (diffMs <= 0) return 'Live / Started';
  const totalMins = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hrs = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  if (days > 0) return `Starts in ${days}d ${hrs}h`;
  if (hrs > 0) return `Starts in ${hrs}h ${mins}m`;
  return `Starts in ${mins}m`;
}

function downloadEventIcs(ev: EventItem) {
  const start = new Date(ev.startsAt);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const toIcs = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chatterbox//Events//EN',
    'BEGIN:VEVENT',
    `UID:${ev.id}@chatterbox`,
    `DTSTAMP:${toIcs(new Date())}`,
    `DTSTART:${toIcs(start)}`,
    `DTEND:${toIcs(end)}`,
    `SUMMARY:${ev.title.replace(/\n/g, ' ')}`,
    `LOCATION:${ev.location.replace(/\n/g, ' ')}`,
    `DESCRIPTION:${(ev.description || 'Official Chatterbox Event').replace(/\n/g, ' ')}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${ev.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export const EventsScreen: React.FC<EventsScreenProps> = ({ currentUser, onNotify }) => {
  const isDeveloper = currentUser.role === 'DEVELOPER';
  const [events, setEvents] = useState<EventItem[]>([]);
  const [category, setCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  // Create Event Form (Developer Control Only)
  const [title, setTitle] = useState('');
  const [newCategory, setNewCategory] = useState('Meetup');
  const [location, setLocation] = useState('Online on Chatterbox');
  const [startsAt, setStartsAt] = useState('');
  const [description, setDescription] = useState('');
  const [bgGradient, setBgGradient] = useState(GRADIENTS[0].id);
  const [creating, setCreating] = useState(false);

  async function loadEvents(selectedCat = category) {
    setLoading(true);
    try {
      const qs = selectedCat && selectedCat !== 'All' ? `?category=${encodeURIComponent(selectedCat)}` : '';
      const res = await apiFetch<{ events: EventItem[] }>(`/api/events${qs}`);
      setEvents(res.events);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to load events.', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents(category);
  }, [category]);

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startsAt) {
      onNotify('Please enter an event title and date/time.', 'error');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<{ event: EventItem }>('/api/events', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          category: newCategory,
          location: location.trim() || 'Online on Chatterbox',
          startsAt: new Date(startsAt).toISOString(),
          description: description.trim(),
          bgGradient,
        }),
      });
      setEvents((prev) => [res.event, ...prev]);
      setCreateOpen(false);
      setTitle('');
      setDescription('');
      setStartsAt('');
      onNotify('Official event published!', 'success');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Could not create event.', 'error');
    } finally {
      setCreating(false);
    }
  }

  async function handleRsvp(ev: EventItem, targetStatus: 'GOING' | 'INTERESTED') {
    const nextStatus = ev.myStatus === targetStatus ? 'NONE' : targetStatus;
    try {
      const res = await apiFetch<{ event: EventItem }>(`/api/events/${ev.id}/rsvp`, {
        method: 'POST',
        body: JSON.stringify({ status: nextStatus }),
      });
      setEvents((prev) => prev.map((item) => (item.id === ev.id ? res.event : item)));
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'RSVP update failed.', 'error');
    }
  }

  async function handleDelete(ev: EventItem) {
    try {
      await apiFetch(`/api/events/${ev.id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((item) => item.id !== ev.id));
      onNotify('Event deleted.', 'info');
    } catch (err) {
      onNotify(err instanceof Error ? err.message : 'Failed to delete event.', 'error');
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-cbox-border bg-cbox-surface p-5 sm:p-6 shadow-soft flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-cbox-text flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-cbox-accent" />
            Chatterbox Events
          </h1>
          <p className="text-xs text-cbox-muted">
            Official community events, gaming tournaments, music nights, and meetups hosted by Developer Control.
          </p>
        </div>

        {isDeveloper ? (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs hover:opacity-95 transition"
          >
            <Plus className="h-4 w-4" />
            Host Official Event
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-cbox-violet/35 bg-cbox-violet/10 text-[11px] font-semibold text-cbox-violet">
            <ShieldCheck className="h-3.5 w-3.5" />
            Developer-Hosted Events
          </span>
        )}
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {CATEGORIES.map((cat) => {
          const active = category === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition border ${
                active
                  ? 'bg-cbox-accent text-slate-950 border-cbox-accent'
                  : 'bg-cbox-surface border-cbox-border text-cbox-muted hover:text-cbox-text'
              }`}
            >
              {cat}
            </button>
          );
        })}
      </div>

      {/* Events Grid */}
      {loading ? (
        <LoadingSkeleton variant="card" rows={2} />
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No upcoming events here yet"
          description={
            isDeveloper
              ? 'Publish an official Chatterbox event for the community!'
              : 'Stay tuned — official Chatterbox events hosted by Developer Control will appear here.'
          }
          action={
            isDeveloper ? (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                className="px-4 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs"
              >
                Host an Event
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {events.map((ev) => (
            <article
              key={ev.id}
              className="rounded-2xl border border-cbox-border bg-cbox-surface overflow-hidden shadow-soft flex flex-col"
            >
              <div className={`bg-gradient-to-r ${ev.bgGradient} p-4 text-white flex items-start justify-between gap-2`}>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-black/30 backdrop-blur">
                      {ev.category}
                    </span>
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/20 backdrop-blur">
                      {formatCountdown(ev.startsAt)}
                    </span>
                  </div>
                  <h2 className="text-base font-bold leading-snug">{ev.title}</h2>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => downloadEventIcs(ev)}
                    title="Export to Calendar (.ics)"
                    className="p-1.5 rounded-lg bg-black/25 hover:bg-black/45 transition text-white"
                  >
                    <CalendarPlus className="h-4 w-4" />
                  </button>
                  {isDeveloper && (
                    <button
                      type="button"
                      onClick={() => handleDelete(ev)}
                      className="p-1.5 rounded-lg bg-black/25 hover:bg-black/45 transition text-white"
                      aria-label="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-cbox-muted">
                    <span className="inline-flex items-center gap-1.5 text-cbox-text font-medium">
                      <Clock className="h-3.5 w-3.5 text-cbox-accent" />
                      {new Date(ev.startsAt).toLocaleString([], {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-cbox-violet" />
                      {ev.location}
                    </span>
                  </div>

                  {ev.description && (
                    <p className="text-cbox-text/90 leading-relaxed">{ev.description}</p>
                  )}

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-2">
                      <Avatar src={ev.creator.avatarUrl} name={ev.creator.primaryNickname} size="sm" />
                      <span className="text-[11px] text-cbox-muted">
                        Official Host <strong className="text-cbox-text">@{ev.creator.username}</strong>
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-[11px] text-cbox-muted">
                      <Users className="h-3.5 w-3.5" />
                      {ev.goingCount} going · {ev.interestedCount} interested
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-cbox-border">
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev, 'GOING')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      ev.myStatus === 'GOING'
                        ? 'bg-cbox-accent text-slate-950 border-cbox-accent'
                        : 'bg-cbox-elevated/60 border-cbox-border text-cbox-text hover:border-cbox-accent'
                    }`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {ev.myStatus === 'GOING' ? 'Going' : 'Join / Going'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRsvp(ev, 'INTERESTED')}
                    className={`py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${
                      ev.myStatus === 'INTERESTED'
                        ? 'bg-cbox-violet text-white border-cbox-violet'
                        : 'bg-cbox-elevated/60 border-cbox-border text-cbox-text hover:border-cbox-violet'
                    }`}
                  >
                    <Star className="h-3.5 w-3.5" />
                    Interested
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create Event Modal — Strictly Developer Control Only */}
      {isDeveloper && (
        <Modal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          title="Host Official Chatterbox Event"
          description="Only Developer Control accounts can publish public events."
        >
          <form onSubmit={handleCreateEvent} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-cbox-muted">Event Title</label>
              <input
                type="text"
                required
                minLength={3}
                maxLength={100}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Weekend Valorant Custom Lobby"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cbox-muted">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-cbox-muted">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3 py-2 text-sm text-cbox-text"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cbox-muted">Location or Link</label>
              <input
                type="text"
                required
                maxLength={120}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Online on Chatterbox / Mumbai Meetup"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-cbox-muted">Description</label>
              <textarea
                rows={3}
                maxLength={600}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's happening at this event?"
                className="w-full rounded-xl bg-cbox-elevated border border-cbox-border px-3.5 py-2 text-sm text-cbox-text"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-cbox-muted">Banner Style</label>
              <div className="flex flex-wrap gap-2">
                {GRADIENTS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setBgGradient(g.id)}
                    className={`h-8 px-3 rounded-xl text-[11px] font-semibold text-white bg-gradient-to-r ${g.id} ${
                      bgGradient === g.id ? 'ring-2 ring-cbox-accent ring-offset-2 ring-offset-cbox-surface' : 'opacity-75'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="px-4 py-2 rounded-xl border border-cbox-border text-xs font-semibold text-cbox-text"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-5 py-2 rounded-xl bg-cbox-accent text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {creating ? 'Publishing…' : 'Publish Official Event'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
