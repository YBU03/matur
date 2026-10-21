export const MAX_DELETE_USERS = 100;
export type DeleteTarget = {
  id: string;
  nama: string;
  email: string | null;
  assignments: { peran: string }[];
};
export type DeleteOutcome = {
  id: string;
  nama: string;
  email: string | null;
  ok?: string;
  error?: string;
};
export type DeleteBatchResult = { error?: string; hasil?: DeleteOutcome[] };
export const targetHapus = (users: Pick<DeleteTarget, "nama">[]) =>
  users.length === 1 ? users[0].nama : `HAPUS ${users.length} PENGGUNA`;
export const bolehHapus = (user: DeleteTarget, meId: string) =>
  user.id !== meId && !user.assignments.some((a) => a.peran === "owner");
