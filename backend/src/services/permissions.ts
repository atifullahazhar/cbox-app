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

export async function canViewStory(viewerId: string, story: {
  authorId: string;
  audience: PostAudience;
  expiresAt: Date;
  deletedAt: Date | null;
}): Promise<boolean> {
  if (story.deletedAt !== null || story.expiresAt <= new Date()) return false;
  if (story.authorId === viewerId) return true;

  const blockState = await getBlockState(viewerId, story.authorId);
  if (blockState.anyBlock) return false;

  if (story.audience === PostAudience.PUBLIC) return true;
  return areFriends(viewerId, story.authorId);
}

export async function canViewMedia(viewerId: string, mediaId: string): Promise<boolean> {
  const asset = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    include: {
      post: true,
      story: true,
      message: { include: { conversation: true } },
    },
  });
  if (!asset) return false;

  if (asset.purpose === 'POST_IMAGE') {
    if (!asset.post) return asset.ownerId === viewerId;
    return canViewPost(viewerId, asset.post);
  }

  if (asset.purpose === 'STORY_IMAGE') {
    if (!asset.story) return asset.ownerId === viewerId;
    return canViewStory(viewerId, asset.story);
  }

  if (asset.purpose === 'CHAT_IMAGE' || asset.purpose === 'CHAT_AUDIO' || asset.purpose === 'CHAT_VIDEO') {
    if (!asset.message) {
      // Group or Community media asset (no 1:1 message relation)
      const grpMsg = await prisma.groupMessage.findFirst({ where: { mediaId: asset.id }, select: { groupId: true } });
      if (grpMsg) {
        const mem = await prisma.groupMember.findUnique({ where: { groupId_userId: { groupId: grpMsg.groupId, userId: viewerId } } });
        return Boolean(mem);
      }
      const commMsg = await prisma.communityMessage.findFirst({ where: { mediaId: asset.id }, include: { channel: { select: { communityId: true } } } });
      if (commMsg) {
        const mem = await prisma.communityMember.findUnique({ where: { communityId_userId: { communityId: commMsg.channel.communityId, userId: viewerId } } });
        return Boolean(mem);
      }
      return asset.ownerId === viewerId;
    }
    if (asset.message.deletedAt !== null) return false;
    const conv = asset.message.conversation;
    if (conv.userAId !== viewerId && conv.userBId !== viewerId) return false;
    const otherId = conv.userAId === viewerId ? conv.userBId : conv.userAId;
    const blockState = await getBlockState(viewerId, otherId);
    return !blockState.anyBlock;
  }

  if (asset.ownerId === viewerId) return true;
  const blockState = await getBlockState(viewerId, asset.ownerId);
  return !blockState.anyBlock;
}
