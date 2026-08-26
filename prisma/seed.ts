import 'dotenv/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
});
const prisma = new PrismaClient({ adapter });

const currencies = [
  ['USD', 'US Dollar', '$'],
  ['EUR', 'Euro', '€'],
  ['GBP', 'British Pound', '£'],
  ['TRY', 'Turkish Lira', '₺'],
  ['SAR', 'Saudi Riyal', 'ر.س'],
  ['AED', 'UAE Dirham', 'د.إ'],
  ['QAR', 'Qatari Riyal', 'ر.ق'],
  ['KWD', 'Kuwaiti Dinar', 'د.ك'],
  ['JOD', 'Jordanian Dinar', 'د.ا'],
  ['EGP', 'Egyptian Pound', 'ج.م'],
] as const;

async function main() {
  for (const [code, name, symbol] of currencies) {
    await prisma.currency.upsert({
      where: { code },
      update: { name, symbol, enabled: true },
      create: { code, name, symbol },
    });
  }

  await prisma.currencySource.upsert({
    where: { slug: 'sp-today' },
    update: {
      name: 'SP Today',
      url: 'https://www.sp-today.com/currencies',
      priority: 10,
      denomination: 'OLD_SYP',
      normalizationFactor: 0.01,
    },
    create: {
      name: 'SP Today',
      slug: 'sp-today',
      url: 'https://www.sp-today.com/currencies',
      priority: 10,
      denomination: 'OLD_SYP',
      normalizationFactor: 0.01,
    },
  });

  await prisma.currencySource.upsert({
    where: { slug: 'syp-now' },
    update: {
      name: 'SYPNow',
      url: 'https://sypnow.com/en/rates',
      priority: 20,
      denomination: 'OLD_SYP',
      normalizationFactor: 0.01,
    },
    create: {
      name: 'SYPNow',
      slug: 'syp-now',
      url: 'https://sypnow.com/en/rates',
      priority: 20,
      denomination: 'OLD_SYP',
      normalizationFactor: 0.01,
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
