// App roles (User.app_role): "reviewer" can review and approve; "viewer" reads only.
// Only the STORED role counts: the Scan / Nodule / EditEvent RLS checks the stored app_role on the server, so the
// UI must never assume a role that isn't saved (bug in c857403: a user with no stored role was shown as reviewer,
// setup tried to update the Scan and the server refused).
export const DEFAULT_ROLE = 'reviewer'; // review period (Stav, 20 Oct): new users become reviewers

export const storedRole = (user) => user?.app_role || null;
export const needsRole = (user) => !!user && !storedRole(user);

// A signed-in user with no stored role gets DEFAULT_ROLE saved on their own User record (SDK auth.updateMe: users
// may update their own custom fields). Returns the saved role; throws if the server refuses.
export async function ensureRole(auth, user) {
  if (!needsRole(user)) return storedRole(user);
  const saved = await auth.updateMe({ app_role: DEFAULT_ROLE });
  return storedRole(saved) || DEFAULT_ROLE;
}
