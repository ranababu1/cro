import { db } from '@/lib/db';

/**
 * Test users get a completed profile by default so tests that are not about onboarding can create
 * and start experiments. Pass first_name: null to create a user without a profile.
 */
const original = db.createUser.bind(db);
db.createUser = async (data) => {
    const u = await original(data);
    if (data.first_name === null || data.onboarding_pending) return u;
    await db.updateUserProfile(u.id, {
        first_name: data.first_name ?? 'Test', last_name: data.last_name ?? 'User', country: 'US', phone: null, company: null,
        job_role: null, company_size: null, heard_from: null, primary_goal: null, marketing_opt_in: false,
    });
    return (await db.getUser(u.id))!;
};
