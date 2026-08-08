export function toMemberRef(user: { id: string; name: string | null; email: string } | null) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email };
}
