// ── Enums (matching backend Prisma enums, lowercase for API transport) ──

export type RoleName = "SUPER_ADMIN" | "CHANNEL_ADMIN" | "CREATOR_ADMIN" | "USER";

export type VideoStatus = "DRAFT" | "UNPUBLISHED" | "PUBLISHED" | "SCHEDULED" | "PROCESSING" | "ARCHIVED";
export type VideoVisibility = "PUBLIC" | "UNLISTED" | "PRIVATE";
export type AssetStatus = "CREATED" | "UPLOADED" | "PROCESSING" | "READY" | "ERRORED";
export type PlaybackPolicy = "PUBLIC" | "SIGNED";
export type ThumbnailType = "POSTER" | "THUMBNAIL" | "HERO" | "LANDING";

export type BillingInterval = "MONTHLY" | "YEARLY";
export type ConcurrencyTier = "STREAMS_1" | "STREAMS_3" | "STREAMS_5";
export type AdTier = "WITH_ADS" | "WITHOUT_ADS";
export type VideoAccessType = "FREE" | "FREE_WITH_ADS" | "SUBSCRIPTION" | "BUNDLE" | "RENTAL" | "PURCHASE";

export type SubscriptionStatus = "INCOMPLETE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED" | "TRIALING";
export type RentalStatus = "ACTIVE" | "EXPIRED" | "REFUNDED";
export type PurchaseStatus = "ACTIVE" | "REFUNDED";

export type ContentRowScopeType = "PLATFORM" | "CHANNEL";
export type LandingDestinationType = "CHANNEL" | "VIDEO" | "EXTERNAL";
export type AccessSourceType = "FREE" | "FREE_WITH_ADS" | "SUBSCRIPTION" | "BUNDLE" | "RENTAL" | "PURCHASE";

// ── Core models ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerifiedAt: string | null;
  stripeCustomerId: string | null;
  isActive: boolean;
  roles: UserRole[];
  profiles?: Profile[];
  createdAt: string;
  updatedAt: string;
}

export interface UserRole {
  id: string;
  roleId: string;
  channelId: string | null;
  creatorProfileId: string | null;
  role: { key: RoleName; name: string };
  name?: RoleName; // convenience alias set by some API responses
}

export interface Profile {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  isKidsProfile: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Channel {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  isActive: boolean;
  defaultCurrency: string;
  allowedAccessTypes: VideoAccessType[];
  subscriptionPlans?: SubscriptionPlan[];
  _count?: { videos?: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreatorProfile {
  id: string;
  slug: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  channelId: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  _count?: { videos?: number; videoLinks?: number };
  createdAt: string;
  updatedAt: string;
}

export interface Video {
  id: string;
  slug: string;
  channelId: string;
  creatorProfileId: string | null;
  /** Assigned categories (many-to-many). */
  categories?: { id: string; name: string; slug: string }[];
  title: string;
  description: string | null;
  shortDescription: string | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  publishedAt: string | null;
  scheduledPublishAt: string | null;
  durationSeconds: number | null;
  releaseDate: string | null;
  isFree: boolean;
  freeWithAds: boolean;
  cheaperWithAdsAllowed: boolean;
  hasPrerollAds: boolean;
  hasMidrollAds: boolean;
  allowDownload: boolean;
  trailerVideoId: string | null;
  previewText: string | null;
  channel?: Channel;
  creatorProfile?: CreatorProfile;
  videoAssets?: VideoAsset[];
  thumbnailAssets?: ThumbnailAsset[];
  tagAssignments?: VideoTagAssignment[];
  videoAccessRules?: VideoAccessRule[];
  rentalOptions?: RentalOption[];
  purchaseOptions?: PurchaseOption[];
  thumbnailUrl?: string | null;
  duration?: number | null;
  rentalOption?: RentalOption;
  purchaseOption?: PurchaseOption;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAsset {
  id: string;
  videoId: string;
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  playbackPolicy: PlaybackPolicy;
  assetStatus: AssetStatus;
  durationSeconds: number | null;
  aspectRatio: string | null;
  sourceFileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ThumbnailAsset {
  id: string;
  videoId: string | null;
  channelId: string | null;
  type: ThumbnailType;
  imageUrl: string;
  altText: string | null;
  createdAt: string;
}

export interface VideoTag {
  id: string;
  name: string;
  slug: string;
}

export interface VideoTagAssignment {
  id: string;
  videoId: string;
  tagId: string;
  tag: VideoTag;
}

export interface VideoAccessRule {
  id: string;
  videoId: string;
  accessType: VideoAccessType;
  subscriptionPlanId: string | null;
  bundleId: string | null;
  rentalOptionId: string | null;
  purchaseOptionId: string | null;
  channelId: string | null;
  subscriptionPlan?: SubscriptionPlan;
  bundle?: Bundle;
  rentalOption?: RentalOption;
  purchaseOption?: PurchaseOption;
}

export interface SubscriptionPlan {
  id: string;
  channelId: string;
  name: string;
  description: string | null;
  stripeProductId: string | null;
  isActive: boolean;
  priceVariants?: PlanPriceVariant[];
  channel?: Channel;
  createdAt: string;
  updatedAt: string;
}

export interface PlanPriceVariant {
  id: string;
  planId: string;
  billingInterval: BillingInterval;
  concurrencyTier: ConcurrencyTier;
  adTier: AdTier;
  price: number;
  currency: string;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bundle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  billingInterval: BillingInterval;
  concurrencyTier: ConcurrencyTier;
  adTier: AdTier;
  price: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  bundleChannels?: BundleChannel[];
  createdAt: string;
  updatedAt: string;
}

export interface BundleChannel {
  id: string;
  bundleId: string;
  channelId: string;
  channel?: Channel;
}

export interface RentalOption {
  id: string;
  videoId: string;
  name: string;
  rentalHours: number;
  concurrencyTier: ConcurrencyTier;
  price: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface PurchaseOption {
  id: string;
  videoId: string;
  name: string;
  concurrencyTier: ConcurrencyTier;
  price: number;
  currency: string;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ContentRow {
  id: string;
  scopeType: ContentRowScopeType;
  channelId: string | null;
  title: string;
  subtitle: string | null;
  sortOrder: number;
  isActive: boolean;
  items?: ContentRowItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentRowItem {
  id: string;
  contentRowId: string;
  videoId: string | null;
  channelId: string | null;
  thumbnailAssetId: string | null;
  sortOrder: number;
  video?: Video;
  channel?: Channel;
  thumbnailAsset?: ThumbnailAsset;
  createdAt: string;
}

export interface LandingHero {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  destinationType: LandingDestinationType;
  channelId: string | null;
  videoId: string | null;
  externalUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  channel?: Channel;
  video?: Video;
  createdAt: string;
}

export type HomepageElementType =
  | "HERO"
  | "CONTENT_ROW"
  | "CHANNEL_ROW"
  | "TEXT_DIVIDER"
  | "LINE_DIVIDER";

export interface HomepageElement {
  id: string;
  type: HomepageElementType;
  sortOrder: number;
  isActive: boolean;
  title: string | null;
  subtitle: string | null;
  imageUrl: string | null;
  text: string | null;
  items?: HomepageElementItem[];
  createdAt: string;
  updatedAt: string;
}

export interface HomepageElementItem {
  id: string;
  homepageElementId: string;
  videoId: string | null;
  sortOrder: number;
  video?: Video;
  createdAt: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  channelId: string;
  subscriptionPlanId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
  subscriptionPlan?: SubscriptionPlan;
  channel?: Channel;
  createdAt: string;
  updatedAt: string;
}

export interface UserBundleSubscription {
  id: string;
  userId: string;
  bundleId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  bundle?: Bundle;
  createdAt: string;
  updatedAt: string;
}

export interface UserRental {
  id: string;
  userId: string;
  videoId: string;
  rentalOptionId: string;
  purchasedAt: string;
  accessStartsAt: string;
  accessEndsAt: string;
  status: RentalStatus;
  video?: Video;
  rentalOption?: RentalOption;
}

export interface UserPurchase {
  id: string;
  userId: string;
  videoId: string;
  purchaseOptionId: string;
  purchasedAt: string;
  status: PurchaseStatus;
  video?: Video;
  purchaseOption?: PurchaseOption;
}

export interface PaymentMethod {
  id: string;
  stripePaymentMethodId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
  createdAt: string;
}

export interface Device {
  id: string;
  deviceName: string;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
}

export interface WatchHistory {
  id: string;
  userId: string;
  profileId: string | null;
  videoId: string;
  progressSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
  video?: Video;
}

export interface WatchSession {
  id: string;
  userId: string;
  videoId: string;
  startedAt: string;
  lastHeartbeatAt: string;
  endedAt: string | null;
  playbackSeconds: number | null;
  accessSourceType: AccessSourceType;
}

export interface DiscountCode {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENT" | "FIXED";
  amount: number;
  isActive: boolean;
}

export interface DiscountValidation {
  valid: boolean;
  discount: DiscountCode;
}

export interface AccessCheckResult {
  allowed: boolean;
  reason: string;
  accessType: VideoAccessType | null;
  adMode: "none" | "preroll" | "midroll" | "preroll_midroll" | "full_ads";
  maxConcurrentStreams: number;
  playbackPolicy: PlaybackPolicy;
  tokenRequired: boolean;
}

export interface PlaybackTokenResponse {
  token: string;
  playbackId: string;
  sessionId: string;
  access: AccessCheckResult;
}

export interface SalesTransaction {
  id: string;
  stripeInvoiceId: string | null;
  invoiceNumber: string | null;
  eventType: string;
  amount: number | null;
  currency: string | null;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  type: "subscription" | "bundle" | "rental" | "purchase" | "other";
  description: string;
  channelName: string | null;
  bundleName: string | null;
  videoTitle: string | null;
  status: string;
}

// ── API response wrappers ──────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export interface CheckoutSessionResponse {
  sessionId: string;
  url: string;
}

export interface DirectUploadResponse {
  uploadUrl: string;
  uploadId: string;
  videoAssetId: string;
}

// ── Advertiser Platform ────────────────────────────────────────────

export type CampaignStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "ACTIVE"
  | "PAUSED"
  | "REJECTED"
  | "COMPLETED"
  | "CANCELLED";

export type GeoTargetType = "CITY" | "ZIP_CODE";

export type AdCreativeStatus = "CREATED" | "UPLOADED" | "PROCESSING" | "READY" | "ERRORED";

export interface Advertiser {
  id: string;
  email: string;
  companyName: string;
  contactName: string;
  phone: string | null;
  stripeCustomerId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AdCampaign {
  id: string;
  advertiserId: string;
  name: string;
  status: CampaignStatus;
  totalBudget: number;
  dailyMaxSpend: number;
  totalSpent: number;
  /** USD per view; null = use platform default */
  pricePerViewUsd?: string | number | null;
  targetAgeMin: number | null;
  targetAgeMax: number | null;
  startDate: string | null;
  endDate: string | null;
  rejectionReason: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  geoTargets?: AdGeoTarget[];
  channelTargets?: AdCampaignChannel[];
  creatives?: AdCreative[];
  advertiser?: Pick<
    Advertiser,
    "id" | "email" | "companyName" | "contactName" | "phone"
  >;
  dailyCharges?: AdDailyCharge[];
  _count?: { dailyCharges: number };
  createdAt: string;
  updatedAt: string;
}

/** Super-admin list: advertiser with nested campaigns */
export interface AdvertiserWithCampaigns extends Advertiser {
  campaigns: AdCampaign[];
  _count?: { campaigns: number };
}

export interface AdCampaignChannel {
  id: string;
  campaignId: string;
  channelId: string;
  channel?: Pick<Channel, "id" | "slug" | "name" | "logoUrl">;
}

export interface AdGeoTarget {
  id: string;
  campaignId: string;
  type: GeoTargetType;
  value: string;
}

export interface AdCreative {
  id: string;
  campaignId: string;
  muxUploadId: string | null;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  assetStatus: AdCreativeStatus;
  durationSeconds: number | null;
  fileName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdDailyCharge {
  id: string;
  campaignId: string;
  date: string;
  amount: number;
  impressions: number;
  stripePaymentIntentId: string | null;
  createdAt: string;
}

export interface AdvertiserPaymentMethod {
  id: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
}
