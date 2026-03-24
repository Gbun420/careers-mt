import test from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';

// ============================================================
// Validation Schema Tests (Core Business Logic)
// ============================================================

// Inline the schemas to test them directly
const jobCreateSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  companyName: z.string().min(1, 'Company name is required'),
  location: z.string().min(1, 'Location is required'),
  type: z.string().optional(),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  salaryMin: z.number().positive('salaryMin must be positive'),
  salaryMax: z.number().positive('salaryMax must be positive'),
  pricing: z.enum(['free', 'standard', 'premium', 'ppqa', 'executive']),
  budgetCap: z.number().positive().optional().nullable(),
  knockoutQuestions: z.array(z.object({
    question: z.string(),
    required: z.boolean(),
    rejectIfNo: z.boolean()
  })).optional().default([])
}).refine(data => data.salaryMin <= data.salaryMax, {
  message: 'salaryMin must be less than or equal to salaryMax',
  path: ['salaryMin']
}).refine(data => {
  if (data.pricing === 'ppqa' || data.pricing === 'executive') {
    return data.budgetCap !== null && data.budgetCap !== undefined && data.budgetCap >= 12;
  }
  return true;
}, {
  message: 'Budget cap is required for paid plans (min 12)',
  path: ['budgetCap']
});

const applySchema = z.object({
  jobId: z.string().min(1),
  resumeText: z.string().min(50, "Resume must be at least 50 characters")
});

const setRoleSchema = z.object({
  uid: z.string().min(1),
  role: z.enum(['CANDIDATE', 'EMPLOYER', 'ADMIN'])
});

// ============================================================
// Job Creation Validation Tests
// ============================================================
test('Job Creation Schema Validation', async (t) => {

  await t.test('valid job payload passes validation', () => {
    const validJob = {
      title: 'Senior Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: 30000,
      salaryMax: 50000,
      pricing: 'free',
    };

    const result = jobCreateSchema.safeParse(validJob);
    assert.equal(result.success, true);
  });

  await t.test('rejects job with missing title', () => {
    const invalidJob = {
      title: '',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: 30000,
      salaryMax: 50000,
      pricing: 'free',
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);
  });

  await t.test('rejects job with negative salary', () => {
    const invalidJob = {
      title: 'Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: -1000,
      salaryMax: 50000,
      pricing: 'free',
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);
  });

  await t.test('rejects job when salaryMin > salaryMax', () => {
    const invalidJob = {
      title: 'Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: 60000,
      salaryMax: 40000,
      pricing: 'free',
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);
  });

  await t.test('rejects job with short description', () => {
    const invalidJob = {
      title: 'Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'short',
      salaryMin: 30000,
      salaryMax: 50000,
      pricing: 'free',
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);
  });

  await t.test('requires budgetCap for ppqa pricing', () => {
    const invalidJob = {
      title: 'Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: 30000,
      salaryMax: 50000,
      pricing: 'ppqa',
      budgetCap: null,
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);
  });

  await t.test('accepts valid ppqa pricing with budgetCap', () => {
    const validJob = {
      title: 'Developer',
      companyName: 'Test Corp',
      location: 'Malta',
      description: 'A'.repeat(50),
      salaryMin: 30000,
      salaryMax: 50000,
      pricing: 'ppqa',
      budgetCap: 100,
    };

    const result = jobCreateSchema.safeParse(validJob);
    assert.equal(result.success, true);
  });
});

// ============================================================
// Application Validation Tests
// ============================================================
test('Application Schema Validation', async (t) => {

  await t.test('valid application payload passes validation', () => {
    const validApp = {
      jobId: 'job-123',
      resumeText: 'A'.repeat(50),
    };

    const result = applySchema.safeParse(validApp);
    assert.equal(result.success, true);
  });

  await t.test('rejects application with missing jobId', () => {
    const invalidApp = {
      resumeText: 'A'.repeat(50),
    };

    const result = applySchema.safeParse(invalidApp);
    assert.equal(result.success, false);
  });

  await t.test('rejects application with short resume', () => {
    const invalidApp = {
      jobId: 'job-123',
      resumeText: 'short',
    };

    const result = applySchema.safeParse(invalidApp);
    assert.equal(result.success, false);
  });
});

// ============================================================
// Role Assignment Validation Tests
// ============================================================
test('Role Assignment Schema Validation', async (t) => {

  await t.test('valid role assignment passes validation', () => {
    const validRole = {
      uid: 'user-123',
      role: 'EMPLOYER',
    };

    const result = setRoleSchema.safeParse(validRole);
    assert.equal(result.success, true);
  });

  await t.test('rejects assignment with missing uid', () => {
    const invalidRole = {
      role: 'EMPLOYER',
    };

    const result = setRoleSchema.safeParse(invalidRole);
    assert.equal(result.success, false);
  });

  await t.test('rejects assignment with invalid role', () => {
    const invalidRole = {
      uid: 'user-123',
      role: 'SUPERADMIN',
    };

    const result = setRoleSchema.safeParse(invalidRole as any);
    assert.equal(result.success, false);
  });

  await t.test('accepts all valid roles', () => {
    const roles = ['CANDIDATE', 'EMPLOYER', 'ADMIN'];

    for (const role of roles) {
      const result = setRoleSchema.safeParse({ uid: 'user-123', role });
      assert.equal(result.success, true, `Role ${role} should be valid`);
    }
  });
});

// ============================================================
// Error Response Format Tests
// ============================================================
test('Error Response Formats', async (t) => {

  await t.test('ZodError returns proper validation details', () => {
    const invalidJob = {
      title: '',
      salaryMin: -1000,
    };

    const result = jobCreateSchema.safeParse(invalidJob);
    assert.equal(result.success, false);

    if (!result.success) {
      const errors = result.error.errors;
      assert.ok(errors.length > 0, 'Should have validation errors');
      assert.ok(errors.some(e => e.path.includes('title')), 'Should have title error');
      assert.ok(errors.some(e => e.path.includes('salaryMin')), 'Should have salaryMin error');
    }
  });
});
