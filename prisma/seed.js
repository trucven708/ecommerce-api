require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  for (const rolename of ['admin', 'customer']) {
    await prisma.role.upsert({
      where: { rolename },
      update: {},
      create: { rolename },
    });
  }

  const tiers = [
    { mname: 'Basic', score: 0 },
    { mname: 'Silver', score: 100 },
    { mname: 'Gold', score: 500 },
  ];
  for (const tier of tiers) {
    await prisma.memberShip.upsert({
      where: { mname: tier.mname },
      update: {},
      create: tier,
    });
  }

  console.log('Seed xong: roles và memberships');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());