import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';

async function testLogin() {
  try {
    const email = 'admin@parentshield.com';
    const password = 'Demo123!';

    console.log('1. Finding user...');
    const user = await prisma.user.findUnique({
      where: { email },
      include: { subscriptions: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!user) {
      console.log('User not found');
      return;
    }
    console.log('2. User found:', user.email);

    console.log('3. Verifying password...');
    const isValid = await bcrypt.compare(password, user.passwordHash);
    console.log('4. Password valid:', isValid);

    console.log('5. Creating tokens...');
    const now = Math.floor(Date.now() / 1000);
    const accessToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      iat: now,
      exp: now + 15 * 60,
    }, JWT_SECRET);
    console.log('6. Access token created');

    const refreshToken = jwt.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
      iat: now,
      exp: now + 7 * 24 * 60 * 60,
    }, JWT_SECRET);
    console.log('7. Refresh token created');

    console.log('8. Storing refresh token...');
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    console.log('9. Refresh token stored');

    console.log('Login successful!');
  } catch (err) {
    console.error('Error:', err);
  }
}

testLogin().finally(() => prisma.$disconnect());
