import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './db';
import crypto from 'crypto';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SECRET_KEY;
  if (!secret) {
    throw new Error('JWT_SECRET or SECRET_KEY environment variable is required');
  }
  return secret;
}
const JWT_SECRET = getJwtSecret();
const ACCESS_TOKEN_EXPIRE_MINUTES = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || '15');
const REFRESH_TOKEN_EXPIRE_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || '7');

export interface TokenPayload {
  sub: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  exp: number;
  iat: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function createAccessToken(userId: string, email: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: userId,
    email,
    role,
    type: 'access',
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRE_MINUTES * 60,
  };
  return jwt.sign(payload, JWT_SECRET);
}

export function createRefreshToken(userId: string, email: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = {
    sub: userId,
    email,
    role,
    type: 'refresh',
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
  };
  return jwt.sign(payload, JWT_SECRET);
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

export function generateActivationCode(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numbers = '0123456789';
  let code = '';
  for (let i = 0; i < 3; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  code += '-';
  for (let i = 0; i < 3; i++) {
    code += numbers[Math.floor(Math.random() * numbers.length)];
  }
  return code;
}

export function generateApiKey(): { key: string; prefix: string } {
  const randomPart = crypto.randomBytes(24).toString('base64url');
  const key = `ps_live_${randomPart}`;
  const prefix = key.substring(0, 12);
  return { key, prefix };
}

export async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const payload = verifyToken(token);

  if (!payload || payload.type !== 'access') {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    include: {
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function requireAuth(request: NextRequest) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);
  if (user.role !== 'admin') {
    throw new Error('Forbidden');
  }
  return user;
}

export async function getApiKeyUser(request: NextRequest) {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey) {
    return null;
  }

  const keyHash = hashToken(apiKey);
  const apiKeyRecord = await prisma.aPIKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    },
    include: {
      user: true,
    },
  });

  if (!apiKeyRecord) {
    return null;
  }

  await prisma.aPIKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsed: new Date() },
  });

  return apiKeyRecord.user;
}

export function getSubscriptionFeatures(plan: string) {
  const features: Record<string, Record<string, boolean | number>> = {
    free: {
      maxDevices: 1,
      screenTimeManagement: true,
      appBlocking: true,
      webFiltering: false,
      locationTracking: false,
      activityReports: false,
      cloudSync: false,
      prioritySupport: false,
    },
    basic: {
      maxDevices: 3,
      screenTimeManagement: true,
      appBlocking: true,
      webFiltering: true,
      locationTracking: false,
      activityReports: true,
      cloudSync: false,
      prioritySupport: false,
    },
    pro: {
      maxDevices: 10,
      screenTimeManagement: true,
      appBlocking: true,
      webFiltering: true,
      locationTracking: true,
      activityReports: true,
      cloudSync: true,
      prioritySupport: true,
    },
  };
  return features[plan] || features.free;
}
