import { describe, it, expect } from 'vitest';
import { agencyVerificationSchema, agencyRegisterSchema } from './validation';
import { runFreeChecks, allFreeChecksPass, isValidNpi } from './agency-verification';
import { isUsState } from './us-states';

const goodDetails = {
  legalName: 'Bright Futures Foster Agency LLC',
  ein: '12-3456789',
  usState: 'TX',
  licenseNumber: 'CPA-99',
  phone: '5125550100',
  addressLine: '123 Main St',
  city: 'Austin',
  postalCode: '78701',
  website: 'https://brightfutures.example',
};

describe('agencyVerificationSchema', () => {
  it('accepts complete US agency details and normalises the EIN', () => {
    const r = agencyVerificationSchema.safeParse({ ...goodDetails, ein: '123456789' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ein).toBe('12-3456789');
  });

  it('uppercases and validates the state', () => {
    const r = agencyVerificationSchema.safeParse({ ...goodDetails, usState: 'tx' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.usState).toBe('TX');
  });

  it('rejects a non-US / unknown state', () => {
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, usState: 'ZZ' }).success).toBe(false);
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, usState: 'Ontario' }).success).toBe(false);
  });

  it('rejects a malformed EIN', () => {
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, ein: '123' }).success).toBe(false);
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, ein: '000000000' }).success).toBe(false);
  });

  it('requires a full address', () => {
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, addressLine: '' }).success).toBe(false);
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, postalCode: '' }).success).toBe(false);
  });
});

describe('agencyRegisterSchema', () => {
  it('requires credentials on top of the agency details', () => {
    expect(agencyRegisterSchema.safeParse(goodDetails).success).toBe(false); // missing name/email/password/agencyName
    const r = agencyRegisterSchema.safeParse({
      ...goodDetails,
      name: 'Pat Carer',
      email: 'Admin@BrightFutures.COM',
      password: 'GoodPass123',
      agencyName: 'Bright Futures',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('admin@brightfutures.com');
  });
});

describe('runFreeChecks', () => {
  it('passes every check for a legitimate US agency', () => {
    const checks = runFreeChecks(goodDetails);
    expect(allFreeChecksPass(checks)).toBe(true);
  });

  it('flags a non-US state and a bad EIN', () => {
    const checks = runFreeChecks({ ...goodDetails, usState: 'ZZ', ein: 'nope' });
    expect(allFreeChecksPass(checks)).toBe(false);
    expect(checks.find((c) => c.key === 'usState')?.pass).toBe(false);
    expect(checks.find((c) => c.key === 'ein')?.pass).toBe(false);
  });
});

describe('isValidNpi (NPI check-digit / Luhn with 80840 prefix)', () => {
  it('accepts a valid NPI and rejects a bad check digit', () => {
    expect(isValidNpi('1234567893')).toBe(true); // canonical CMS example
    expect(isValidNpi('1234567890')).toBe(false);
    expect(isValidNpi('123')).toBe(false);
    expect(isValidNpi('')).toBe(false);
    expect(isValidNpi(null)).toBe(false);
  });
});

describe('NPI is optional in agency details', () => {
  it('accepts no NPI, a valid NPI, and rejects a non-10-digit NPI', () => {
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, npi: '' }).success).toBe(true);
    const r = agencyVerificationSchema.safeParse({ ...goodDetails, npi: '123456789 3' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.npi).toBe('1234567893');
    expect(agencyVerificationSchema.safeParse({ ...goodDetails, npi: '12345' }).success).toBe(false);
  });

  it('free check flags an invalid provided NPI but passes when omitted', () => {
    expect(runFreeChecks({ ...goodDetails }).find((c) => c.key === 'npi')?.pass).toBe(true);
    expect(runFreeChecks({ ...goodDetails, npi: '1234567890' }).find((c) => c.key === 'npi')?.pass).toBe(false);
  });
});

describe('isUsState', () => {
  it('recognises states case-insensitively and rejects others', () => {
    expect(isUsState('ca')).toBe(true);
    expect(isUsState('DC')).toBe(true);
    expect(isUsState('ZZ')).toBe(false);
    expect(isUsState(null)).toBe(false);
  });
});
