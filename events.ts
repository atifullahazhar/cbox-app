import { Router } from 'express';
import { z } from 'zod';
import { EventRsvpStatus, UserRole } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { type AuthenticatedRequest, requireAuth } from '../middleware/auth.js';
import { toPublicUserDTO } from '../utils/security.js';
import { assertSafeText } from '../services/moderation.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const ALLOWED_CATEGORIES = new Set(['Meetup', 'Gaming', 'Music', 'Tech', 'Art', 'Watch Party']);
const ALLOWED_GRADIENTS = new Set([
  'from-sky-600 to-indigo-900',
  'from-pink-600 to-rose-900',
  'from-emerald-600 to-teal-950',
  'from-violet-600 to-fuchsia-900',
  'from-amber-600 to-orange-950',
]);

function serializeEvent(ev: any, viewerId: string) {
  const rsvps = ev.rsvps || [];
  const goingCount = rsvps.filter((r: any) => r.status === 'GOING').length;
  const interestedCount = rsvps.filter((r: any) => r.status === 'INTERESTED').length;
  const mine = rsvps.find((r: any) => r.userId === viewerId);

  return {
    id: ev.id,
    title: ev.title,
    category: ev.category,
    description: ev.description,
    location: ev.location,
    startsAt: ev.startsAt.toISOString(),
    bgGradient: ev.bgGradient,
    goingCount,
    interestedCount,
    myStatus: mine ? mine.status : null,
    isCreator: ev.creatorId === viewerId,
    creator: toPublicUserDTO(ev.creator),
    createdAt: ev.createdAt.toISOString(),
  };
}

// List public community events (visible to all authenticated users)
eventsRouter.get('/', async (req: AuthenticatedRequest, res) => {
  const viewerId = req.auth!.user.id;
  const category = typeof req.query.category === 'string' && req.query.category !== 'All' ? req.query.category : undefined;

  const events = await prisma.event.findMany({
    where: {
      ...(category ? { category } : {}),
    },
    include: {
      creator: true,
      rsvps: { select: { userId: true, status: true } },
    },
    orderBy: { startsAt: 'asc' },
    take: 50,
  });

  res.json({ events: events.map((e) => serializeEvent(e, viewerId)) });
});

// Create a new public event — STRICTLY DEVELOPER CONTROL ONLY
eventsRouter.post('/', async (req: AuthenticatedRequest, res) => {
  if (req.auth!.user.role !== UserRole.DEVELOPER) {
    res.status(403).json({ error: 'Only Developer Control accounts can host public events.' });
    return;
  }

  const schema = z.object({
    title: z.string().trim().min(3).max(100),
    category: z.string().default('Meetup'),
    description: z.string().trim().max(600).default(''),
    location: z.string().trim().min(2).max(120).default('Online on Chatterbox'),
    startsAt: z.string(),
    bgGradient: z.string().default('from-sky-600 to-indigo-900'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Provide an event title and valid date/time.' });
    return;
  }

  try {
    assertSafeText(parsed.data.title);
    assertSafeText(parsed.data.description);
    assertSafeText(parsed.data.location);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : 'Blocked by Safety Filter.' });
    return;
  }

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) {
    res.status(400).json({ error: 'Invalid event date/time.' });
    return;
  }

  const created = await prisma.event.create({
    data: {
      creatorId: req.auth!.user.id,
      title: parsed.data.title,
      category: ALLOWED_CATEGORIES.has(parsed.data.category) ? parsed.data.category : 'Meetup',
      description: parsed.data.description,
      location: parsed.data.location,
      startsAt,
      bgGradient: ALLOWED_GRADIENTS.has(parsed.data.bgGradient) ? parsed.data.bgGradient : 'from-sky-600 to-indigo-900',
      rsvps: {
        create: { userId: req.auth!.user.id, status: EventRsvpStatus.GOING },
      },
    },
    include: {
      creator: true,
      rsvps: { select: { userId: true, status: true } },
    },
  });

  res.status(201).json({ event: serializeEvent(created, req.auth!.user.id) });
});

// RSVP to an event (GOING | INTERESTED | NONE) — open to all users
eventsRouter.post('/:id/rsvp', async (req: AuthenticatedRequest, res) => {
  const schema = z.object({ status: z.enum(['GOING', 'INTERESTED', 'NONE']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid RSVP status.' });
    return;
  }

  const viewerId = req.auth!.user.id;
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }

  if (parsed.data.status === 'NONE') {
    await prisma.eventRsvp.deleteMany({ where: { eventId: ev.id, userId: viewerId } });
  } else {
    await prisma.eventRsvp.upsert({
      where: { eventId_userId: { eventId: ev.id, userId: viewerId } },
      update: { status: parsed.data.status },
      create: { eventId: ev.id, userId: viewerId, status: parsed.data.status },
    });
  }

  const refreshed = await prisma.event.findUnique({
    where: { id: ev.id },
    include: { creator: true, rsvps: { select: { userId: true, status: true } } },
  });

  res.json({ event: serializeEvent(refreshed, viewerId) });
});

// Delete event — STRICTLY DEVELOPER CONTROL ONLY
eventsRouter.delete('/:id', async (req: AuthenticatedRequest, res) => {
  if (req.auth!.user.role !== UserRole.DEVELOPER) {
    res.status(403).json({ error: 'Only Developer Control can delete events.' });
    return;
  }
  const ev = await prisma.event.findUnique({ where: { id: req.params.id } });
  if (!ev) {
    res.status(404).json({ error: 'Event not found.' });
    return;
  }
  await prisma.event.delete({ where: { id: ev.id } });
  res.json({ ok: true });
});
