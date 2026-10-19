import { requireStaff } from "@/lib/auth";
import { ticketDeletionSchema } from "@/lib/domain";
import { handle, readBody } from "@/lib/http";
import { store } from "@/lib/store";

export const runtime = "nodejs";
export async function DELETE(request: Request) {
  return handle(request, async () => {
    const staff = await requireStaff(true);
    const input = ticketDeletionSchema.parse(await readBody(request));
    return store.deleteTickets(input, staff.id);
  });
}
