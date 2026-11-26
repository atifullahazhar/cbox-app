import type { ThemeKey } from '../themes';

export type UserRole = 'USER' | 'DEVELOPER';
export type GroupRank = 'OWNER' | 'ADMIN' | 'VICE_ADMIN' | 'MEMBER';
export type ThemePreference = 'SYSTEM' | 'LIGHT' | 'DARK';
export type PostAudience = 'FRIENDS_ONLY' | 'PUBLIC' | 'CLOSE_FRIENDS';
export type NavSection = 'profile' | 'chat' | 'posts' | 'communities' | 'developer';

export interface SafeUser {
  id: string;
  username: string;
  usernameNormalized: string;
  primaryNickname: string;
  alternateNicknames: string[];
  bio: string;
  avatarUrl: string | null;
  bannerUrl: string | null;
  dateOfBirth?: string | null;
  isPrivateProfile?: boolean;
  isVerified?: boolean;
  phoneMasked?: string | null;
  hasSecretPin?: boolean;
  totpEnabled?: boolean;
  hideOnlineStatus?: boolean;
  disableReadReceipts?: boolean;
  theme?: ThemePreference;
  themeKey?: ThemeKey;
  role?: UserRole;
  customFlair?: string;
  avatarFrame?: string;
  profileEffect?: string;
  customStatusEmoji?: string;
  customStatusText?: string;
  profileMusicTitle?: string;
  profileMusicArtist?: string;
  profileMusicPreset?: string;
  profileMusicUrl?: string | null;
  bioLinks?: Array<{ label: string; url: string }>;
  interestTags?: string[];
  showProfileViews?: boolean;
  isCloseFriend?: boolean;
  isDemo?: boolean;
  createdAt?: string;
}

export interface ProfileBadgeItem {
  id: string;
  label: string;
  emoji: string;
  tone: 'dev' | 'verified' | 'gold' | 'violet' | 'emerald' | 'sky';
  description: string;
}

export interface StoryHighlightStory {
  id: string;
  imageUrl: string | null;
  textContent: string;
  bgGradient: string;
  expiresAt: string;
  createdAt: string;
}

export interface StoryHighlightItem {
  id: string;
  title: string;
  coverEmoji: string;
  createdAt: string;
  stories: StoryHighlightStory[];
}

export interface ProfileVisitorItem {
  viewedAt: string;
  viewer: SafeUser;
}

export interface ChatRequestItem {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DENIED';
  deniedAt?: string | null;
  cooldownEndsAt?: string | null;
  createdAt: string;
  user: SafeUser;
}

export interface CommunitySummary {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  bannerGradient: string;
  isPublic: boolean;
  inviteCode: string;
  myRole: GroupRank | null;
  memberCount: number;
  channelCount: number;
  createdAt: string;
}

export interface CommunityChannel {
  id: string;
  name: string;
  type: 'TEXT' | 'VOICE';
  topic: string;
  readonlyForMembers: boolean;
  slowModeSeconds: number;
}

export interface CommunityMember {
  user: SafeUser;
  role: GroupRank;
  online: boolean;
  joinedAt: string;
}

export interface CommunityMessage {
  id: string;
  communityId?: string;
  channelId: string;
  content: string;
  mediaUrl?: string | null;
  mediaKind?: 'IMAGE' | 'AUDIO' | 'VIDEO' | null;
  isPinned?: boolean;
  senderRole: GroupRank;
  sender: SafeUser;
  createdAt: string;
}

export interface ProfileStats {
  postCount: number;
  friendCount: number;
  profileViewsCount?: number | null;
}

export interface SessionInfo {
  id: string;
  userAgent: string;
  ipAddress: string;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export interface FriendListItem {
  friend: SafeUser;
  online: boolean;
  conversationId: string | null;
  hiddenInVault?: boolean;
  disappearAfterSeconds?: number;
  unreadCount: number;
  lastMessage: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  } | null;
}

export interface FriendRequestItem {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'DENIED' | 'CANCELED';
  createdAt: string;
  user: SafeUser;
}

export interface LookupResult {
  user: SafeUser;
  relationship: 'NONE' | 'FRIENDS' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'BLOCKED_BY_YOU';
  pendingRequestId: string | null;
}

export interface MessageReactionGroup {
  emoji: string;
  userIds: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  clientTempId?: string | null;
  content: string;
  mediaUrl?: string | null;
  mediaKind?: 'IMAGE' | 'AUDIO' | 'VIDEO' | null;
  replyTo?: {
    id: string;
    senderId: string;
    content: string;
  } | null;
  reactions?: MessageReactionGroup[];
  deliveryState: 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  expiresAt?: string | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  createdAt: string;
}

export interface GroupSummary {
  id: string;
  name: string;
  description: string;
  inviteCode: string;
  wallpaper?: string;
  myRole: GroupRank;
  memberCount: number;
  lastMessage: {
    id: string;
    senderName: string;
    content: string;
    createdAt: string;
  } | null;
}

export interface GroupMemberItem {
  role: GroupRank;
  joinedAt: string;
  user: SafeUser;
}

export interface GroupMessageItem {
  id: string;
  groupId: string;
  content: string;
  mediaUrl?: string | null;
  mediaKind?: 'IMAGE' | 'AUDIO' | 'VIDEO' | null;
  senderRole?: GroupRank;
  createdAt: string;
  sender: SafeUser;
}

export interface GroupPollItem {
  id: string;
  groupId: string;
  question: string;
  options: string[];
  counts: number[];
  totalVotes: number;
  myVote: number | null;
  creator: SafeUser;
  createdAt: string;
}

export interface PostItem {
  id: string;
  isPinned?: boolean;
  caption: string;
  audience: PostAudience;
  imageUrl: string;
  mediaId: string;
  isOwner: boolean;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  createdAt: string;
  updatedAt: string;
  author: SafeUser;
}

export interface PostCommentItem {
  id: string;
  postId: string;
  content: string;
  isOwner: boolean;
  createdAt: string;
  author: SafeUser;
}

export interface StoryItem {
  id: string;
  imageUrl: string | null;
  textContent: string;
  bgGradient: string;
  audience: PostAudience;
  isOwner: boolean;
  viewedByMe: boolean;
  viewCount: number;
  viewers?: Array<{ viewedAt: string; user: SafeUser }>;
  expiresAt: string;
  createdAt: string;
  author: SafeUser;
}

export interface BlockedUserItem {
  id: string;
  blockedAt: string;
  user: SafeUser;
}

export interface SafetyReportItem {
  id: string;
  reason: string;
  details: string;
  status: 'OPEN' | 'REVIEWED' | 'DISMISSED';
  targetPostId: string | null;
  createdAt: string;
  reporter: SafeUser;
  targetUser: SafeUser | null;
}

export interface DeveloperStatusResponse {
  accessStatus: string;
  account: { id: string; username: string; role: UserRole };
  policies: {
    allowBlockingDevelopers: boolean;
    developerCodeMode: string;
    storageDriver: string;
  };
  recentAuditEvents: Array<{
    id: string;
    action: string;
    outcome: string;
    createdAt: string;
  }>;
  upcomingModules: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
  }>;
}
