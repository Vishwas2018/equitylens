export type OrgRole = 'owner' | 'admin' | 'accountant' | 'viewer';

export interface Session {
  userId: string;
  email: string;
  /** Supabase Auth Assurance Level — aal1 = password only, aal2 = MFA verified */
  aal: 'aal1' | 'aal2';
  expiresAt: number;
}

export interface ActiveOrg {
  orgId: string;
  role: OrgRole;
  isDefault: boolean;
}

export interface UserContext {
  session: Session;
  activeOrg: ActiveOrg | null;
}
