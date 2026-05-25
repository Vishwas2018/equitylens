import type { ApiSession } from '../auth/api-guard';
import { getRlsAwareClient } from '../db/client';

export interface PropertyRow {
  id: string;
  portfolio_id: string;
  address_line1: string;
  address_line2: string | null;
  suburb: string;
  state: string;
  postcode: string;
  property_type: string;
  purchase_date: string;
  purchase_price_cents: number;
  stamp_duty_paid_cents: number;
  acquisition_costs_cents: number;
  current_estimated_value_cents: number | null;
  ownership_kind: string;
  status: 'draft' | 'active' | 'sold' | 'archived';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const PROPERTY_FIELDS = [
  'id',
  'portfolio_id',
  'address_line1',
  'address_line2',
  'suburb',
  'state',
  'postcode',
  'property_type',
  'purchase_date',
  'purchase_price_cents',
  'stamp_duty_paid_cents',
  'acquisition_costs_cents',
  'current_estimated_value_cents',
  'ownership_kind',
  'status',
  'notes',
  'created_at',
  'updated_at',
].join(', ');

export async function getProperties(sess: ApiSession) {
  const result = await getRlsAwareClient(sess.accessToken)
    .from('properties')
    .select(PROPERTY_FIELDS)
    .eq('org_id', sess.orgId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  return { data: (result.data ?? []) as unknown as PropertyRow[], error: result.error };
}

export async function getProperty(propertyId: string, sess: ApiSession) {
  const result = await getRlsAwareClient(sess.accessToken)
    .from('properties')
    .select(PROPERTY_FIELDS)
    .eq('id', propertyId)
    .eq('org_id', sess.orgId)
    .is('deleted_at', null)
    .single();
  return { data: result.data as unknown as PropertyRow | null, error: result.error };
}
