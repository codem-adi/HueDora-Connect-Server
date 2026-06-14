import User from '../models/User.js';
import { ROLES } from '../config/constants.js';

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'admin123';

const DEFAULT_USERS = [
  { name: 'Super Admin', email: 'superadmin@huedoraconnect.com', role: ROLES.SUPER_ADMIN },
  { name: 'Camp Admin', email: 'admin@huedoraconnect.com', role: ROLES.ADMIN },
  { name: 'Ops Executive', email: 'ops@huedoraconnect.com', role: ROLES.OPERATIONS_EXECUTIVE },
  { name: 'Camp Reviewer', email: 'reviewer@huedoraconnect.com', role: ROLES.REVIEWER },
  { name: 'Read Only User', email: 'viewer@huedoraconnect.com', role: ROLES.READ_ONLY },
];

export async function ensureDefaultUsers() {
  for (const seedUser of DEFAULT_USERS) {
    const email = seedUser.email.toLowerCase();
    const existing = await User.findOne({ email, deletedAt: null });
    if (existing) continue;

    await User.create({
      name: seedUser.name,
      email,
      password: DEFAULT_PASSWORD,
      role: seedUser.role,
    });

    console.log(`[auth] Created default user ${email}`);
  }
}
