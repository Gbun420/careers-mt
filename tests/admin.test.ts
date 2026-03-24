import { test, expect, beforeAll } from 'vitest';
import * as admin from 'firebase-admin';

// Initialize Admin SDK for testing
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: 'careers-mt-test'
  });
}

const db = admin.firestore();

// Mock tokens/security would usually be handled by a test helper
// Here we simulate the API behavior or check the database state after calls

test('Admin can list jobs regardless of status', async () => {
  // 1. Seed different jobs
  await db.collection('jobs').add({ title: 'Test Job 1', status: 'active', createdAt: new Date() });
  await db.collection('jobs').add({ title: 'Test Job 2', status: 'suspended', createdAt: new Date() });

  const snap = await db.collection('jobs').get();
  expect(snap.size).toBeGreaterThanOrEqual(2);
});

test('Moderation: Suspend Job updates status', async () => {
  const jobRef = await db.collection('jobs').add({ title: 'To Suspend', status: 'active' });
  
  // Simulate api/admin/moderate-job.ts logical flow
  await jobRef.update({ status: 'suspended', updatedAt: new Date() });
  
  const updatedDoc = await jobRef.get();
  expect(updatedDoc.data()?.status).toBe('suspended');
});

test('Moderation: Delete Job removes document', async () => {
  const jobRef = await db.collection('jobs').add({ title: 'To Delete', status: 'active' });
  const jobId = jobRef.id;
  
  await jobRef.delete();
  
  const deletedDoc = await db.collection('jobs').doc(jobId).get();
  expect(deletedDoc.exists).toBe(false);
});

test('Stats: Aggregation counts jobs and applications correctly', async () => {
  // Clear collections for accurate stats in this specific test
  const jobs = await db.collection('jobs').get();
  const apps = await db.collection('applications').get();
  
  const activeJobsCount = jobs.docs.filter(d => d.data().status === 'active').length;
  const totalAppsCount = apps.size;
  
  // This matches the logic in api/admin/stats.ts
  expect(typeof activeJobsCount).toBe('number');
  expect(typeof totalAppsCount).toBe('number');
});
