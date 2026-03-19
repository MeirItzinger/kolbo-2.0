import { PrismaClient } from "@prisma/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const channelAdminRole = await prisma.role.findUnique({
    where: { key: "CHANNEL_ADMIN" },
  });

  if (!channelAdminRole) {
    console.log("CHANNEL_ADMIN role not found");
    return;
  }

  const channels = await prisma.channel.findMany();

  for (const channel of channels) {
    const email = `admin@${channel.slug.replace(/\s+/g, "").toLowerCase()}.com`;
    const password = channel.name.replace(/\s+/g, "").toLowerCase() + "yechi";

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`SKIP ${channel.name} — user ${email} already exists`);
      continue;
    }

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hashSync(password, 12),
        firstName: channel.name,
        lastName: "Admin",
        emailVerifiedAt: new Date(),
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: channelAdminRole.id,
        channelId: channel.id,
      },
    });

    await prisma.channelAdmin.create({
      data: {
        channelId: channel.id,
        userId: user.id,
      },
    });

    console.log(`CREATED ${email} / ${password} for channel "${channel.name}"`);
  }
}

main().finally(() => prisma.$disconnect());
