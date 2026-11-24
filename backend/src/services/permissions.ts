import { PostAudience } from '@prisma/client';
import { prisma } from '../db/prisma.js';
import { canonicalPair } from '../utils/security.js';

export async function areFriends(userIdA: string, userIdB: string): Promise<boolean> {
  if (userIdA === userIdB) return false;
  const [userAId, userBId] = canonicalPair(userIdA, userIdB);
  const friendship = await prisma.friendship.findUnique({
    where: { userAId_userBId: { userAId, userBId } },
    select: { id: true },
  });
  return Boolean(friendship);
}

export async function getBlockState(viewerId: string, otherUserId: string): Promise<{
  blockedByViewer: boolean;
  blockedByOther: boolean;
  anyBlock: boolean;
}> {
  if (viewerId === otherUserId) {
    return { blockedByViewer: false, blockedByOther: false, anyBlock: false };
  }
  const blocks = await prisma.block.findMany({
    where: {
      OR: [
        { blockerId: viewerId, blockedId: otherUserId },
        { blockerId: otherUserId, blockedId: viewerId },
      ],
    },
    select: { blockerId: true, blockedId: true },
  });

  const blockedByViewer = blocks.some((b) => b.blockerId === viewerId);
  const blockedByOther = blocks.some((b) => b.blockerId === otherUserId);
  return { blockedByViewer, blockedByOther, anyBlock: blockedByViewer || blockedByOther };
}

export async function getBlockedUserIds(userId: string): Promise<Set<string>> {
  const blocks = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const ids = new Set<string>();
  for (const b of blocks) {
    ids.add(b.blockerId === userId ? b.blockedId : b.blockerId);
  }
  return ids;
}

export async function getFriendIds(userId: string): Promise<string[]> {
  const rows = await prisma.friendship.findMany({
    where: { OR: [{ userAId: userId }, { userBId: userId }] },
    select: { userAId: true, userBId: true },
  });
  return rows.map((r) => (r.userAId === userId ? r.userBId : r.userAId));
}

/**
 * Enforces post audience rules strictly on the server.
 * Note: Developer role NEVER bypasses FRIENDS_ONLY post visibility or blocks.
 */
export async function canViewPost(viewerId: string, post: {
  authorId: string;
  audience: PostAudience;
  deletedAt: Date | null;
}): Promise<boolean> {
  if (post.deletedAt !== null) return false;
  if (post.authorId === viewerId) return true;

  const blockState = await getBlockState(viewerId, post.authorId);
  if (blockState.anyBlock) return false;

  if (post.audience === PostAudience.PUBLIC) return true;
  return areFriends(viewerId, post.authorId);
}

/**
 * Authorizes access to any MediaAsset (AVATAR, BANNER, or POST_IMAGE).
 * Prevents bypassing post audience rules via direct /api/media/:id calls.
 */
export async function canViewMedia(viewerId: string, mediaId: string): Promise<boolean> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    include: { post: true },
  });
  if (!asset) return false;

  if (asset.purpose === 'POST_IMAGE') {
    if (!asset.post) return asset.ownerId === viewerId;
    return canViewPost(viewerId, asset.post);
  }

  // Avatars and banners are visible to authenticated users unless blocked
  if (asset.ownerId === viewerId) return true;
  const blockState = await getBlockState(viewerId, asset.ownerId);
  return !blockState.anyBlock;
}
