const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const channel = await p.channel.findFirst({ where: { slug: "toveedo" } });
  if (!channel) {
    console.error("Toveedo channel not found");
    process.exit(1);
  }

  let category = await p.category.findFirst({
    where: {
      channelId: channel.id,
      OR: [
        { slug: { equals: "on-a-roll", mode: "insensitive" } },
        { name: { equals: "On a Roll", mode: "insensitive" } },
      ],
    },
  });

  if (!category) {
    category = await p.category.create({
      data: {
        channelId: channel.id,
        name: "On a Roll",
        slug: "on-a-roll",
        sortOrder: 0,
        isActive: true,
      },
    });
    console.log("Created category:", category.id, category.name);
  } else {
    console.log("Using existing category:", category.id, category.name);
  }

  const videos = await p.video.findMany({
    where: {
      channelId: channel.id,
      title: { contains: "On a Roll", mode: "insensitive" },
    },
    select: { id: true, title: true },
  });

  console.log("Videos matching title contains 'On a Roll':", videos.length);
  videos.forEach((v) => console.log(" ", v.id, v.title));

  for (const v of videos) {
    await p.videoCategory.upsert({
      where: {
        videoId_categoryId: { videoId: v.id, categoryId: category.id },
      },
      create: { videoId: v.id, categoryId: category.id },
      update: {},
    });
    console.log("Linked:", v.title);
  }

  console.log("Done.");
  await p.$disconnect();
})();
