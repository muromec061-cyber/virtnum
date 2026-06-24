import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminHash = await bcrypt.hash('Admin123!', 12);
  const userHash = await bcrypt.hash('User1234!', 12);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@virtnum.io' },
    update: {},
    create: {
      email: 'admin@virtnum.io',
      username: 'admin',
      passwordHash: adminHash,
      role: 'ADMIN',
      balance: 1000,
      isVerified: true,
    },
  });

  const user = await prisma.user.upsert({
    where: { email: 'demo@virtnum.io' },
    update: {},
    create: {
      email: 'demo@virtnum.io',
      username: 'demo_user',
      passwordHash: userHash,
      balance: 25.0,
      isVerified: true,
    },
  });

  const countries = [
    { name: 'Russia', code: 'RU', dialCode: '+7', flag: '🇷🇺' },
    { name: 'United States', code: 'US', dialCode: '+1', flag: '🇺🇸' },
    { name: 'United Kingdom', code: 'GB', dialCode: '+44', flag: '🇬🇧' },
    { name: 'Germany', code: 'DE', dialCode: '+49', flag: '🇩🇪' },
    { name: 'France', code: 'FR', dialCode: '+33', flag: '🇫🇷' },
    { name: 'China', code: 'CN', dialCode: '+86', flag: '🇨🇳' },
    { name: 'India', code: 'IN', dialCode: '+91', flag: '🇮🇳' },
    { name: 'Brazil', code: 'BR', dialCode: '+55', flag: '🇧🇷' },
    { name: 'Ukraine', code: 'UA', dialCode: '+380', flag: '🇺🇦' },
    { name: 'Kazakhstan', code: 'KZ', dialCode: '+7', flag: '🇰🇿' },
  ];

  const createdCountries: any[] = [];
  for (const c of countries) {
    const country = await prisma.country.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
    createdCountries.push(country);
  }

  const numberData = [
    { number: '+79161234567', countryCode: 'RU', price: 0.5, isTelegram: true },
    { number: '+79267654321', countryCode: 'RU', price: 0.5, isTelegram: true },
    { number: '+79031112233', countryCode: 'RU', price: 0.5, isTelegram: false },
    { number: '+12025551234', countryCode: 'US', price: 1.5, isTelegram: true },
    { number: '+12025559876', countryCode: 'US', price: 1.5, isTelegram: true },
    { number: '+442071234567', countryCode: 'GB', price: 2.0, isTelegram: true },
    { number: '+4915123456789', countryCode: 'DE', price: 1.8, isTelegram: true },
    { number: '+33123456789', countryCode: 'FR', price: 1.8, isTelegram: false },
    { number: '+380671234567', countryCode: 'UA', price: 0.3, isTelegram: true },
    { number: '+380931234567', countryCode: 'UA', price: 0.3, isTelegram: true },
    { number: '+77771234567', countryCode: 'KZ', price: 0.4, isTelegram: true },
    { number: '+8613812345678', countryCode: 'CN', price: 2.5, isTelegram: false },
  ];

  for (const n of numberData) {
    const country = createdCountries.find((c) => c.code === n.countryCode);
    if (!country) continue;
    await prisma.virtualNumber.upsert({
      where: { number: n.number },
      update: {},
      create: {
        number: n.number,
        countryId: country.id,
        price: n.price,
        isTelegram: n.isTelegram,
        status: 'AVAILABLE',
      },
    });
  }

  console.log('✅ Seed complete');
  console.log(`Admin: admin@virtnum.io / Admin123!`);
  console.log(`Demo:  demo@virtnum.io  / User1234!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
