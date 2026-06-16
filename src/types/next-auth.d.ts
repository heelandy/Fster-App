import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: 'USER' | 'ADMIN';
      tokenVersion: number;
    };
  }
  interface User {
    id: string;
    role: 'USER' | 'ADMIN';
    tokenVersion: number;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    role: 'USER' | 'ADMIN';
    tv: number;
  }
}
