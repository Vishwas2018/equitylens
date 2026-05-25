import type { ApiSession } from '../auth/api-guard';
import { getRlsAwareClient } from '../db/client';

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

export async function getProperty(propertyId: string, sess: ApiSession) {
  return getRlsAwareClient(sess.accessToken)
    .from('properties')
    .select(PROPERTY_FIELDS)
    .eq('id', propertyId)
    .eq('org_id', sess.orgId)
    .is('deleted_at', null)
    .single();
}
