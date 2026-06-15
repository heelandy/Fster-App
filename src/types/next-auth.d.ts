import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: 'USER' | 'ADMIN';
    };
  }
  interface User {
    id: string;
    role: 'USER' | 'ADMIN';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid: string;
    role: 'USER' | 'ADMIN';
  }
}
