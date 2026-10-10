import mongoose from "mongoose";

const LEGACY_ROLE_NAMES = {
  "Project Manager": "PROJECT_MANAGER",
  "Team Member": "TEAM_MEMBER",
  Viewer: "VIEWER",
};

export async function migrateLegacyMemberships() {
  const database = mongoose.connection.db;
  const legacyMemberships = await database
    .collection("projectmembers")
    .find({ role: { $exists: false }, roleId: { $exists: true } })
    .toArray();

  if (legacyMemberships.length === 0) return;

  const roleIds = legacyMemberships.map((membership) => membership.roleId);
  const roles = await database
    .collection("roles")
    .find({ _id: { $in: roleIds } })
    .project({ name: 1 })
    .toArray();
  const roleById = new Map(
    roles.map((role) => [String(role._id), LEGACY_ROLE_NAMES[role.name]]),
  );
  const updates = legacyMemberships
    .map((membership) => ({ membership, role: roleById.get(String(membership.roleId)) }))
    .filter(({ role }) => role)
    .map(({ membership, role }) => ({
      updateOne: {
        filter: { _id: membership._id },
        update: { $set: { role }, $unset: { roleId: "" } },
      },
    }));

  if (updates.length > 0) {
    await database.collection("projectmembers").bulkWrite(updates);
    console.log(`Migrated ${updates.length} legacy project membership(s)`);
  }
}
