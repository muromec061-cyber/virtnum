import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Countries
  const ru = await prisma.country.upsert({
    where: { code: 'RU' },
    update: {},
    create: { code: 'RU', name: 'Россия', flag: '🇷🇺' }
  });
  const us = await prisma.country.upsert({
    where: { code: 'US' },
    update: {},
    create: { code: 'US', name: 'США', flag: '🇺🇸' }
  });
  const gb = await prisma.country.upsert({
    where: { code: 'GB' },
    update: {},
    create: { code: 'GB', name: 'Великобритания', flag: '🇬🇧' }
  });

  // Phone numbers
  const numbers = [
    { number: '+79991234567', countryId: ru.id, isForTelegram: true, price: 1.50 },
    { number: '+79997654321', countryId: ru.id, isForTelegram: true, price: 1.50 },
    { number: '+79990001111', countryId: ru.id, isForTelegram: false, price: 1.00 },
    { number: '+18005551234', countryId: us.id, isForTelegram: true, price: 2.50 },
    { number: '+18005559876', countryId: us.id, isForTelegram: false, price: 2.00 },
    { number: '+447700900123', countryId: gb.id, isForTelegram: true, price: 3.00 },
  ];

  for (const n of numbers) {
    await prisma.phoneNumber.upsert({
      where: { number: n.number },
      update: {},
      create: n
    });
  }

  // Admin user
  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.default.hash('admin12345', 10);
  await prisma.user.upsert({
    where: { email: 'admin@virtnum.com' },
    update: {},
    create: {
      email: 'admin@virtnum.com',
      username: 'admin',
      passwordHash: hash,
      role: 'ADMIN',
      balance: 100.00,
      isVerified: true
    }
  });

  console.log('✅ Seed complete: 3 countries, 6 numbers, 1 admin user');
}

main().catch(console.error).finally(() => prisma.$disconnect());
