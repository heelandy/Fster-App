import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: 'USER' | 'ADMIN';
      tokenVersion: number;
      sid?: string; // UserSession id for this device (per-device revocation)
    };
  }
  interface User {
    id: string;
    role: 'USER' | 'ADMIN';
    tokenVersion: number;
    sid?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    role: 'USER' | 'ADMIN';
    tv: number;
    sid?: string;
  }
}
