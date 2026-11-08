import type { TRAINING_LESSONS } from '../../../shared/training';

type Catalogue = { lessons: typeof TRAINING_LESSONS; adminUnavailable: boolean };
/** A platform-admin role alone does not establish an MFA-authenticated session. */
export async function loadTrainingCatalogue(isAdmin: boolean, request: typeof fetch = fetch): Promise<Catalogue> {
 const ordinary = await request('/api/training', { credentials: 'include' });
 if (!ordinary.ok) throw new Error('TRAINING_CATALOGUE_UNAVAILABLE');
 const data = await ordinary.json();
 const result: Catalogue = { lessons: data.lessons.filter((lesson: typeof TRAINING_LESSONS[number]) => lesson.audience !== 'admin'), adminUnavailable: isAdmin };
 if (!isAdmin) return result;
 try {
  const admin = await request('/api/training/admin', { credentials: 'include' });
  if (admin.ok) return { lessons: (await admin.json()).lessons, adminUnavailable: false };
 } catch { /* The ordinary catalogue remains usable if the optional request fails. */ }
 return result;
}
