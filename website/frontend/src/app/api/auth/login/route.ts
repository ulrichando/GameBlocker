import { NextRequest } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, createAccessToken, createRefreshToken, hashToken } from '@/lib/auth';
import { success, error, unauthorized, serverError } from '@/lib/api-response';
import { isValidEmail, sanitizeEmail } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return error('Email and password are required');
    }

    if (!isValidEmail(email)) {
      return error('Invalid email format');
    }

    const sanitizedEmail = sanitizeEmail(email);

    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!user) {
      return unauthorized('Invalid email or password');
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return unauthorized('Invalid email or password');
    }

    if (!user.isActive) {
      return unauthorized('Account is suspended');
    }

    const accessToken = createAccessToken(user.id, user.email, user.role);
    const refreshToken = createRefreshToken(user.id, user.email, user.role);

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    const subscription = user.subscriptions[0];

    return success({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        plan: subscription.plan,
        currentPeriodEnd: subscription.currentPeriodEnd,
      } : null,
      accessToken,
      refreshToken,
      tokenType: 'bearer',
    });
  } catch (err) {
    console.error('Login error:', err);
    return serverError();
  }
}
