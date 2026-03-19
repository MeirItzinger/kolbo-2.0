import { PrismaClient } from '@prisma/client';
import {
  RoleKey,
  ChannelCreatorStatus,
  VideoStatus,
  VideoVisibility,
  VideoAccessType,
  ContentRowScopeType,
  LandingDestinationType,
  BillingInterval,
  ConcurrencyTier,
  AdTier,
} from '@prisma/client';
import { hashSync } from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Helpers ────────────────────────────────────────────

function log(section: string, message: string) {
  console.log(`  [${section}] ${message}`);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ─── Seed functions ─────────────────────────────────────

async function seedRoles() {
  console.log('\n🔑 Seeding roles…');

  const roles = [
    { key: RoleKey.SUPER_ADMIN, name: 'Super Admin' },
    { key: RoleKey.CHANNEL_ADMIN, name: 'Channel Admin' },
    { key: RoleKey.CREATOR_ADMIN, name: 'Creator Admin' },
    { key: RoleKey.USER, name: 'User' },
  ];

  const created: Record<string, string> = {};

  for (const r of roles) {
    const role = await prisma.role.upsert({
      where: { key: r.key },
      update: { name: r.name },
      create: { key: r.key, name: r.name },
    });
    created[r.key] = role.id;
    log('roles', `${r.key} → ${role.id}`);
  }

  return created;
}

async function seedStreamConcurrencyLimits() {
  console.log('\n📺 Seeding stream concurrency limits…');

  const tiers = [
    { tierKey: ConcurrencyTier.STREAMS_1, maxStreams: 1 },
    { tierKey: ConcurrencyTier.STREAMS_3, maxStreams: 3 },
    { tierKey: ConcurrencyTier.STREAMS_5, maxStreams: 5 },
  ];

  for (const t of tiers) {
    await prisma.streamConcurrencyLimit.upsert({
      where: { tierKey: t.tierKey },
      update: { maxStreams: t.maxStreams },
      create: { tierKey: t.tierKey, maxStreams: t.maxStreams },
    });
    log('streams', `${t.tierKey} → max ${t.maxStreams}`);
  }
}

async function seedSuperAdmin(roleIds: Record<string, string>) {
  console.log('\n👤 Seeding super admin user…');

  const email = 'admin@kolbo.tv';
  const passwordHash = hashSync('Admin123!', 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      firstName: 'Kolbo',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      passwordHash,
      firstName: 'Kolbo',
      lastName: 'Admin',
      emailVerifiedAt: new Date(),
      isActive: true,
    },
  });

  log('admin', `User ${user.email} → ${user.id}`);

  const superAdminRoleId = roleIds[RoleKey.SUPER_ADMIN];
  const existingRole = await prisma.userRole.findFirst({
    where: { userId: user.id, roleId: superAdminRoleId },
  });
  if (!existingRole) {
    await prisma.userRole.create({
      data: { userId: user.id, roleId: superAdminRoleId },
    });
  }

  log('admin', `Assigned SUPER_ADMIN role`);
  return user;
}

async function seedChannels() {
  console.log('\n📡 Seeding channels…');

  const channelsData = [
    {
      slug: 'kolbo-originals',
      name: 'Kolbo Originals',
      description: "Kolbo's flagship original content — exclusive series, films, and specials you won't find anywhere else.",
      shortDescription: 'Exclusive original content',
    },
    {
      slug: 'torah-live',
      name: 'Torah Live',
      description: 'Engaging, cinematic Torah education for all ages. Bringing ancient wisdom to life with modern storytelling.',
      shortDescription: 'Educational Torah content',
    },
    {
      slug: 'family-cinema',
      name: 'Family Cinema',
      description: 'Curated family-friendly movies and series the whole household can enjoy together.',
      shortDescription: 'Family-friendly movies',
    },
    {
      slug: 'kids-zone',
      name: 'Kids Zone',
      description: 'Safe, fun, and educational programming designed for children of all ages.',
      shortDescription: "Children's programming",
    },
  ];

  const channels: Record<string, string> = {};

  for (const ch of channelsData) {
    const channel = await prisma.channel.upsert({
      where: { slug: ch.slug },
      update: { name: ch.name, description: ch.description, shortDescription: ch.shortDescription },
      create: ch,
    });
    channels[ch.slug] = channel.id;
    log('channels', `${ch.name} → ${channel.id}`);
  }

  return channels;
}

async function seedCreatorProfiles(channelIds: Record<string, string>) {
  console.log('\n🎬 Seeding creator profiles…');

  const creatorsData = [
    {
      slug: 'rabbi-david',
      displayName: 'Rabbi David',
      bio: 'Award-winning Torah educator with over 20 years of experience bringing Torah concepts to life through immersive film and animation.',
      channelSlug: 'torah-live',
    },
    {
      slug: 'studio-harmony',
      displayName: 'Studio Harmony',
      bio: 'Independent production studio specialising in family-friendly films and heartwarming stories.',
      channelSlug: 'family-cinema',
    },
    {
      slug: 'creative-kids',
      displayName: 'Creative Kids',
      bio: "Dedicated children's content creators building educational shows that spark curiosity and imagination.",
      channelSlug: 'kids-zone',
    },
  ];

  const creators: Record<string, string> = {};

  for (const cr of creatorsData) {
    const creator = await prisma.creatorProfile.upsert({
      where: { slug: cr.slug },
      update: { displayName: cr.displayName, bio: cr.bio },
      create: {
        slug: cr.slug,
        displayName: cr.displayName,
        bio: cr.bio,
        isActive: true,
      },
    });
    creators[cr.slug] = creator.id;
    log('creators', `${cr.displayName} → ${creator.id}`);

    const channelId = channelIds[cr.channelSlug];
    await prisma.channelCreator.upsert({
      where: {
        channelId_creatorProfileId: {
          channelId,
          creatorProfileId: creator.id,
        },
      },
      update: { status: ChannelCreatorStatus.APPROVED, approvedAt: new Date() },
      create: {
        channelId,
        creatorProfileId: creator.id,
        status: ChannelCreatorStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
    log('creators', `  Linked to ${cr.channelSlug} (APPROVED)`);
  }

  return creators;
}

async function seedSubscriptionPlans(channelIds: Record<string, string>) {
  console.log('\n💳 Seeding subscription plans…');

  const plans: {
    channelSlug: string;
    name: string;
    billing: BillingInterval;
    concurrency: ConcurrencyTier;
    adTier: AdTier;
    price: number;
  }[] = [];

  for (const slug of Object.keys(channelIds)) {
    const label = slug
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');

    plans.push(
      { channelSlug: slug, name: `${label} — Monthly 3-Stream`, billing: BillingInterval.MONTHLY, concurrency: ConcurrencyTier.STREAMS_3, adTier: AdTier.WITHOUT_ADS, price: 9.99 },
      { channelSlug: slug, name: `${label} — Monthly 3-Stream (Ads)`, billing: BillingInterval.MONTHLY, concurrency: ConcurrencyTier.STREAMS_3, adTier: AdTier.WITH_ADS, price: 7.99 },
      { channelSlug: slug, name: `${label} — Monthly 5-Stream`, billing: BillingInterval.MONTHLY, concurrency: ConcurrencyTier.STREAMS_5, adTier: AdTier.WITHOUT_ADS, price: 14.99 },
      { channelSlug: slug, name: `${label} — Yearly 3-Stream`, billing: BillingInterval.YEARLY, concurrency: ConcurrencyTier.STREAMS_3, adTier: AdTier.WITHOUT_ADS, price: 99.99 },
    );
  }

  const planIds: Record<string, string> = {};

  for (const p of plans) {
    const channelId = channelIds[p.channelSlug];
    const plan = await prisma.subscriptionPlan.upsert({
      where: {
        id: await findPlanId(channelId, p.billing, p.concurrency, p.adTier),
      },
      update: { name: p.name, price: p.price },
      create: {
        channelId,
        name: p.name,
        billingInterval: p.billing,
        concurrencyTier: p.concurrency,
        adTier: p.adTier,
        price: p.price,
        currency: 'usd',
        isActive: true,
      },
    });
    const key = `${p.channelSlug}:${p.billing}:${p.concurrency}:${p.adTier}`;
    planIds[key] = plan.id;
    log('plans', `${p.name} ($${p.price}) → ${plan.id}`);
  }

  return planIds;
}

async function findPlanId(
  channelId: string,
  billing: BillingInterval,
  concurrency: ConcurrencyTier,
  adTier: AdTier,
): Promise<string> {
  const existing = await prisma.subscriptionPlan.findFirst({
    where: { channelId, billingInterval: billing, concurrencyTier: concurrency, adTier },
    select: { id: true },
  });
  return existing?.id ?? 'non-existent-id-for-create';
}

async function seedBundle(channelIds: Record<string, string>) {
  console.log('\n📦 Seeding bundle…');

  const bundle = await prisma.bundle.upsert({
    where: { slug: 'kolbo-complete' },
    update: {
      name: 'Kolbo Complete',
      description: 'All channels, one price. Unlimited access to the entire Kolbo library.',
      price: 29.99,
    },
    create: {
      slug: 'kolbo-complete',
      name: 'Kolbo Complete',
      description: 'All channels, one price. Unlimited access to the entire Kolbo library.',
      billingInterval: BillingInterval.MONTHLY,
      concurrencyTier: ConcurrencyTier.STREAMS_5,
      adTier: AdTier.WITHOUT_ADS,
      price: 29.99,
      currency: 'usd',
      isActive: true,
    },
  });

  log('bundle', `${bundle.name} → ${bundle.id}`);

  for (const [slug, channelId] of Object.entries(channelIds)) {
    await prisma.bundleChannel.upsert({
      where: { bundleId_channelId: { bundleId: bundle.id, channelId } },
      update: {},
      create: { bundleId: bundle.id, channelId },
    });
    log('bundle', `  Linked channel: ${slug}`);
  }

  return bundle;
}

async function seedVideoTags() {
  console.log('\n🏷️  Seeding video tags…');

  const tagNames = [
    'Drama',
    'Comedy',
    'Documentary',
    'Education',
    'Kids',
    'Torah',
    'Family',
    'Music',
    'Live',
    'Series',
  ];

  const tags: Record<string, string> = {};

  for (const name of tagNames) {
    const slug = slugify(name);
    const tag = await prisma.videoTag.upsert({
      where: { slug },
      update: { name },
      create: { name, slug },
    });
    tags[slug] = tag.id;
    log('tags', `${name} → ${tag.id}`);
  }

  return tags;
}

async function seedVideos(
  channelIds: Record<string, string>,
  creatorIds: Record<string, string>,
  tagIds: Record<string, string>,
  adminUserId: string,
) {
  console.log('\n🎥 Seeding sample videos…');

  const videosData = [
    {
      slug: 'the-hidden-light',
      title: 'The Hidden Light',
      description: 'A captivating documentary exploring the deeper meaning behind the creation of light on the first day. Featuring breathtaking visuals and expert commentary.',
      shortDescription: 'Documentary on the mystical first light of creation.',
      channelSlug: 'torah-live',
      creatorSlug: 'rabbi-david',
      status: VideoStatus.PUBLISHED,
      durationSeconds: 2820,
      tags: ['documentary', 'torah', 'education'],
      accessType: VideoAccessType.SUBSCRIPTION,
      isFree: false,
    },
    {
      slug: 'aleph-bet-adventures',
      title: 'Aleph Bet Adventures — Season 1, Episode 1',
      description: 'Join Aleph and Bet on a magical journey through the Hebrew alphabet. Perfect for young learners discovering letters for the first time.',
      shortDescription: 'Animated Hebrew letter learning for kids.',
      channelSlug: 'kids-zone',
      creatorSlug: 'creative-kids',
      status: VideoStatus.PUBLISHED,
      durationSeconds: 1440,
      tags: ['kids', 'education', 'series'],
      accessType: VideoAccessType.FREE,
      isFree: true,
    },
    {
      slug: 'harmony-of-hearts',
      title: 'Harmony of Hearts',
      description: 'A heartwarming family drama about three generations coming together to save the family bakery — and rediscovering what matters most.',
      shortDescription: 'Family drama about love, loss, and challah.',
      channelSlug: 'family-cinema',
      creatorSlug: 'studio-harmony',
      status: VideoStatus.PUBLISHED,
      durationSeconds: 5940,
      tags: ['drama', 'family'],
      accessType: VideoAccessType.SUBSCRIPTION,
      isFree: false,
    },
    {
      slug: 'laugh-out-shabbos',
      title: 'Laugh Out Shabbos — Live Special',
      description: 'A hilarious stand-up comedy event recorded live, featuring the best clean comedians celebrating Shabbat humour.',
      shortDescription: 'Live stand-up comedy special.',
      channelSlug: 'kolbo-originals',
      creatorSlug: null,
      status: VideoStatus.PUBLISHED,
      durationSeconds: 3600,
      tags: ['comedy', 'live'],
      accessType: VideoAccessType.FREE_WITH_ADS,
      isFree: false,
      freeWithAds: true,
    },
    {
      slug: 'behind-the-scenes-kolbo',
      title: 'Behind the Scenes at Kolbo Studios',
      description: 'An exclusive look at how Kolbo Originals are made — from script to screen. Meet the creators, tour the studio, and see the magic happen.',
      shortDescription: 'Exclusive studio tour and creator interviews.',
      channelSlug: 'kolbo-originals',
      creatorSlug: null,
      status: VideoStatus.DRAFT,
      durationSeconds: 1800,
      tags: ['documentary'],
      accessType: VideoAccessType.SUBSCRIPTION,
      isFree: false,
    },
    {
      slug: 'shabbat-singalong',
      title: 'Shabbat Singalong for Kids',
      description: 'Sing along to your favourite Shabbat songs with colourful animations and easy-to-follow lyrics. Great for families!',
      shortDescription: 'Animated Shabbat songs for children.',
      channelSlug: 'kids-zone',
      creatorSlug: 'creative-kids',
      status: VideoStatus.PUBLISHED,
      durationSeconds: 960,
      tags: ['kids', 'music', 'family'],
      accessType: VideoAccessType.FREE,
      isFree: true,
    },
  ];

  const videoIds: Record<string, string> = {};

  for (const v of videosData) {
    const channelId = channelIds[v.channelSlug];
    const creatorProfileId = v.creatorSlug ? creatorIds[v.creatorSlug] : null;

    const video = await prisma.video.upsert({
      where: { slug: v.slug },
      update: {
        title: v.title,
        description: v.description,
        shortDescription: v.shortDescription,
        status: v.status,
        durationSeconds: v.durationSeconds,
        isFree: v.isFree,
        freeWithAds: v.accessType === VideoAccessType.FREE_WITH_ADS,
        publishedAt: v.status === VideoStatus.PUBLISHED ? new Date() : null,
      },
      create: {
        slug: v.slug,
        title: v.title,
        description: v.description,
        shortDescription: v.shortDescription,
        channelId,
        creatorProfileId,
        status: v.status,
        visibility: VideoVisibility.PUBLIC,
        durationSeconds: v.durationSeconds,
        isFree: v.isFree,
        freeWithAds: v.accessType === VideoAccessType.FREE_WITH_ADS,
        publishedAt: v.status === VideoStatus.PUBLISHED ? new Date() : null,
        createdByUserId: adminUserId,
      },
    });

    videoIds[v.slug] = video.id;
    log('videos', `${v.title} (${v.status}) → ${video.id}`);

    for (const tagSlug of v.tags) {
      const tagId = tagIds[tagSlug];
      if (!tagId) continue;

      await prisma.videoTagAssignment.upsert({
        where: { videoId_tagId: { videoId: video.id, tagId } },
        update: {},
        create: { videoId: video.id, tagId },
      });
    }

    await prisma.videoAccessRule.upsert({
      where: {
        id: await findAccessRuleId(video.id, v.accessType),
      },
      update: {},
      create: {
        videoId: video.id,
        accessType: v.accessType,
        channelId: v.accessType === VideoAccessType.SUBSCRIPTION ? channelId : null,
      },
    });
  }

  return videoIds;
}

async function findAccessRuleId(videoId: string, accessType: VideoAccessType): Promise<string> {
  const existing = await prisma.videoAccessRule.findFirst({
    where: { videoId, accessType },
    select: { id: true },
  });
  return existing?.id ?? 'non-existent-id-for-create';
}

async function seedContentRows(
  channelIds: Record<string, string>,
  videoIds: Record<string, string>,
) {
  console.log('\n📋 Seeding content rows…');

  const rowsData = [
    {
      title: 'Trending Now',
      subtitle: 'The most watched content this week',
      scopeType: ContentRowScopeType.PLATFORM,
      channelSlug: null,
      videoSlugs: ['the-hidden-light', 'harmony-of-hearts', 'laugh-out-shabbos', 'shabbat-singalong'],
    },
    {
      title: 'New Releases',
      subtitle: 'Fresh content just added',
      scopeType: ContentRowScopeType.PLATFORM,
      channelSlug: null,
      videoSlugs: ['aleph-bet-adventures', 'harmony-of-hearts', 'shabbat-singalong'],
    },
    {
      title: 'Torah Highlights',
      subtitle: 'Our top picks for Torah learning',
      scopeType: ContentRowScopeType.CHANNEL,
      channelSlug: 'torah-live',
      videoSlugs: ['the-hidden-light'],
    },
  ];

  for (const row of rowsData) {
    const channelId = row.channelSlug ? channelIds[row.channelSlug] : null;

    const existing = await prisma.contentRow.findFirst({
      where: { title: row.title, scopeType: row.scopeType, channelId },
      select: { id: true },
    });

    let contentRow;
    if (existing) {
      contentRow = await prisma.contentRow.update({
        where: { id: existing.id },
        data: { subtitle: row.subtitle, isActive: true },
      });
    } else {
      contentRow = await prisma.contentRow.create({
        data: {
          title: row.title,
          subtitle: row.subtitle,
          scopeType: row.scopeType,
          channelId,
          sortOrder: rowsData.indexOf(row),
          isActive: true,
        },
      });
    }

    log('content-rows', `${row.title} (${row.scopeType}) → ${contentRow.id}`);

    for (let i = 0; i < row.videoSlugs.length; i++) {
      const videoId = videoIds[row.videoSlugs[i]];
      if (!videoId) continue;

      const existingItem = await prisma.contentRowItem.findFirst({
        where: { contentRowId: contentRow.id, videoId },
      });

      if (!existingItem) {
        await prisma.contentRowItem.create({
          data: {
            contentRowId: contentRow.id,
            videoId,
            sortOrder: i,
          },
        });
      }
    }
  }
}

async function seedLandingHeroes(
  channelIds: Record<string, string>,
  videoIds: Record<string, string>,
) {
  console.log('\n🦸 Seeding landing heroes…');

  const heroesData = [
    {
      title: 'Discover Kolbo Originals',
      subtitle: 'Exclusive content you won\'t find anywhere else',
      imageUrl: 'https://placehold.co/1920x600/1a1a2e/e0e0e0?text=Kolbo+Originals',
      destinationType: LandingDestinationType.CHANNEL,
      channelSlug: 'kolbo-originals',
      videoSlug: null,
    },
    {
      title: 'The Hidden Light',
      subtitle: 'Watch the award-winning Torah documentary everyone is talking about',
      imageUrl: 'https://placehold.co/1920x600/2d2d44/e0e0e0?text=The+Hidden+Light',
      destinationType: LandingDestinationType.VIDEO,
      channelSlug: null,
      videoSlug: 'the-hidden-light',
    },
  ];

  for (let i = 0; i < heroesData.length; i++) {
    const h = heroesData[i];
    const channelId = h.channelSlug ? channelIds[h.channelSlug] : null;
    const videoId = h.videoSlug ? videoIds[h.videoSlug] : null;

    const existing = await prisma.landingHero.findFirst({
      where: { title: h.title, destinationType: h.destinationType },
    });

    if (existing) {
      await prisma.landingHero.update({
        where: { id: existing.id },
        data: { subtitle: h.subtitle, imageUrl: h.imageUrl, channelId, videoId, sortOrder: i },
      });
      log('heroes', `Updated: ${h.title}`);
    } else {
      const hero = await prisma.landingHero.create({
        data: {
          title: h.title,
          subtitle: h.subtitle,
          imageUrl: h.imageUrl,
          destinationType: h.destinationType,
          channelId,
          videoId,
          sortOrder: i,
          isActive: true,
        },
      });
      log('heroes', `${h.title} → ${hero.id}`);
    }
  }
}

async function seedPayoutRules(channelIds: Record<string, string>) {
  console.log('\n💰 Seeding payout rules…');

  for (const [slug, channelId] of Object.entries(channelIds)) {
    const existing = await prisma.payoutRule.findFirst({
      where: { channelId, effectiveTo: null },
    });

    if (existing) {
      log('payout-rules', `${slug} already has an active rule — skipping`);
      continue;
    }

    const rule = await prisma.payoutRule.create({
      data: {
        channelId,
        kolboPercent: 20.0,
        channelPercent: 80.0,
        effectiveFrom: new Date(),
      },
    });

    log('payout-rules', `${slug} → 80/20 split → ${rule.id}`);
  }
}

// ─── Main ───────────────────────────────────────────────

async function main() {
  console.log('━'.repeat(50));
  console.log(' Kolbo 2.0 — Database Seed');
  console.log('━'.repeat(50));

  const roleIds = await seedRoles();
  await seedStreamConcurrencyLimits();
  const adminUser = await seedSuperAdmin(roleIds);
  const channelIds = await seedChannels();
  const creatorIds = await seedCreatorProfiles(channelIds);
  await seedSubscriptionPlans(channelIds);
  await seedBundle(channelIds);
  const tagIds = await seedVideoTags();
  const videoIds = await seedVideos(channelIds, creatorIds, tagIds, adminUser.id);
  await seedContentRows(channelIds, videoIds);
  await seedLandingHeroes(channelIds, videoIds);
  await seedPayoutRules(channelIds);

  console.log('\n' + '━'.repeat(50));
  console.log(' Seed complete!');
  console.log('━'.repeat(50) + '\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
