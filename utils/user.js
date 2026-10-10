export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    platformRole: user.platformRole,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}
