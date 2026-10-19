"use client";

import { useState } from "react";
import { LoaderCircle, RotateCcw, Trash2 } from "lucide-react";
import { api, ApiError, message } from "@/lib/client";
import { money, type AdminTicket, type TicketDeletion, type TicketDeletionResult } from "@/lib/domain";

type DeletionDialog = { action: TicketDeletion["action"]; ids: string[]; count: number };
export function AdminTicketTable({ tickets, visibleTickets, isAdmin, busy, onBusyChange, onCancel, onChanged, onUnauthorized }: {
  tickets: AdminTicket[]; visibleTickets: AdminTicket[]; isAdmin: boolean; busy: boolean;
  onBusyChange: (busy: boolean) => void; onCancel: (token: string) => void;
  onChanged: () => Promise<void>; onUnauthorized: () => void;
}) {
  const [selection, setSelection] = useState<string[]>([]);
  const [dialog, setDialog] = useState<DeletionDialog | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const existing = new Set(tickets.map(ticket => ticket.id));
  const selected = selection.filter(id => existing.has(id));
  const chosen = new Set(selected);
  const allVisible = visibleTickets.length > 0 && visibleTickets.every(ticket => chosen.has(ticket.id));
  const expected = dialog?.action === "reset" ? "REINICIAR" : dialog?.action === "clear" ? "ELIMINAR TODO" : "ELIMINAR";

  function toggle(id: string) {
    setError("");
    if (chosen.has(id)) setSelection(selected.filter(value => value !== id));
    else if (selected.length < 300) setSelection([...selected, id]);
    else setError("Puedes seleccionar hasta 300 entradas por operación. Para borrar toda la función usa Eliminar todas.");
  }
  function selectVisible() {
    setError("");
    if (allVisible) setSelection(selected.filter(id => !visibleTickets.some(ticket => ticket.id === id)));
    else {
      const next = [...new Set([...selected, ...visibleTickets.map(ticket => ticket.id)])];
      if (next.length > 300) setError("Puedes seleccionar hasta 300 entradas por operación. Para borrar toda la función usa Eliminar todas.");
      else setSelection(next);
    }
  }
  function ask(action: TicketDeletion["action"], ids: string[] = []) {
    setConfirmation(""); setError(""); setSuccess("");
    setDialog({ action, ids, count: action === "delete" ? ids.length : tickets.length });
  }
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (!dialog || busy || confirmation !== expected) return;
    onBusyChange(true); setError("");
    const command: TicketDeletion = dialog.action === "delete"
      ? { action: "delete", ids: dialog.ids, confirmation: "ELIMINAR" }
      : dialog.action === "clear" ? { action: "clear", confirmation: "ELIMINAR TODO" }
      : { action: "reset", confirmation: "REINICIAR" };
    try {
      const result = await api<TicketDeletionResult>("/api/admin/tickets", { method: "DELETE", body: command });
      setSelection([]); setDialog(null);
      setSuccess(command.action === "reset" ? `Función restablecida. ${result.deleted} entradas eliminadas; pagos e ingresos retirados y butacas liberadas.` : `${result.deleted} entradas eliminadas definitivamente.`);
      await onChanged();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onUnauthorized();
      setError(message(cause));
    } finally { onBusyChange(false); }
  }

  return <>
    {isAdmin && <div className="ticket-selection-actions">
      <span aria-live="polite">{selected.length} seleccionadas</span>
      <button type="button" className="button outline" disabled={busy || !visibleTickets.length} onClick={selectVisible}>{allVisible ? "Deseleccionar visibles" : "Seleccionar visibles"}</button>
      <button type="button" className="button danger-button" disabled={busy || !selected.length} onClick={() => ask("delete", selected)}><Trash2 size={16} />Eliminar seleccionadas</button>
      {!!selected.length && <button type="button" className="text-button" disabled={busy} onClick={() => setSelection([])}>Quitar selección</button>}
    </div>}
    <p className="ticket-results" aria-live="polite">{visibleTickets.length} de {tickets.length} entradas · Se actualiza cada 10 segundos</p>
    {success && <p className="notice success ticket-action-message" role="status">{success}</p>}
    {error && !dialog && <p className="form-error ticket-action-message" role="alert">{error}</p>}
    <div className="table-scroll"><table><thead><tr>
      {isAdmin && <th className="ticket-checkbox"><input type="checkbox" aria-label="Seleccionar todas las entradas visibles" checked={allVisible} disabled={busy || !visibleTickets.length} onChange={selectVisible} /></th>}
      <th>Asistente</th><th>Butaca</th><th>Reserva</th><th>Pago</th><th>Ingreso</th>{isAdmin && <th>Acción</th>}
    </tr></thead><tbody>{visibleTickets.length ? visibleTickets.map(ticket => <tr key={ticket.id} className={chosen.has(ticket.id) ? "selected-ticket-row" : ""}>
      {isAdmin && <td className="ticket-checkbox"><input type="checkbox" aria-label={`Seleccionar entrada ${ticket.seat} de ${ticket.name}`} checked={chosen.has(ticket.id)} disabled={busy} onChange={() => toggle(ticket.id)} /></td>}
      <td>{ticket.name}</td><td><span className="seat-pill">{ticket.seat}</span></td>
      <td><span className={`status-dot ${ticket.status}`} />{ticket.status === "cancelled" ? "Cancelada" : ticket.admitted_at ? "Ingresó" : "Reservada"}</td>
      <td>{ticket.paid_at ? money(ticket.price) : "Pendiente"}</td>
      <td>{ticket.admitted_at ? new Date(ticket.admitted_at).toLocaleTimeString("es-PE", { timeZone: "America/Lima", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
      {isAdmin && <td><div className="ticket-row-actions">{ticket.status === "reserved" && <button type="button" className="text-button danger" disabled={busy} onClick={() => onCancel(ticket.token)}>Cancelar</button>}<button type="button" className="text-button danger" disabled={busy} onClick={() => ask("delete", [ticket.id])}>Eliminar</button></div></td>}
    </tr>) : <tr><td colSpan={isAdmin ? 7 : 5} className="empty-row">{tickets.length ? "No hay entradas con estos filtros." : "Aún no hay reservas. Las nuevas entradas aparecerán aquí."}</td></tr>}</tbody></table></div>
    {isAdmin && <div className="admin-destructive-actions">
      <div><h3>Borrado definitivo</h3><p>Elimina también entradas pagadas, ingresadas y canceladas. Sus QR dejan de funcionar.</p></div>
      <button type="button" className="button danger-button" disabled={busy || !tickets.length} onClick={() => ask("clear")}><Trash2 size={16} />Eliminar todas</button>
      <button type="button" className="button danger-button" disabled={busy} onClick={() => ask("reset")}><RotateCcw size={16} />Restablecer función</button>
    </div>}
    {dialog && <div className="dialog-backdrop"><section className="confirm-dialog delete-tickets-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-tickets-title" aria-describedby="delete-tickets-description" onKeyDown={event => { if (event.key === "Escape" && !busy) setDialog(null); }}>
      <h2 id="delete-tickets-title">{dialog.action === "reset" ? "¿Restablecer toda la función?" : dialog.action === "clear" ? "¿Eliminar todas las entradas?" : `¿Eliminar ${dialog.count} entrada${dialog.count === 1 ? "" : "s"}?`}</h2>
      <p id="delete-tickets-description">{dialog.action === "delete" ? "Las entradas seleccionadas desaparecerán de todas las listas, junto con sus pagos, ingresos y registros. Sus butacas quedarán libres." : "Se borrarán todas las reservas, entradas, pagos e ingresos de esta función, incluidas las canceladas. Todas las butacas quedarán libres."} Los QR anteriores dejarán de ser válidos. Esta acción no se puede deshacer.{dialog.action === "reset" && " Las reservas volverán a habilitarse conservando la fecha, horario y precio de la función."}</p>
      <form onSubmit={remove}><label htmlFor="delete-tickets-confirmation">Escribe {expected} para confirmar</label><input id="delete-tickets-confirmation" autoFocus autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} disabled={busy} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="delete-dialog-buttons"><button type="button" className="button outline" disabled={busy} onClick={() => setDialog(null)}>Volver</button><button type="submit" className="button danger-button" disabled={busy || confirmation !== expected}>{busy ? <LoaderCircle size={18} className="spin" /> : <Trash2 size={16} />}{dialog.action === "reset" ? "Restablecer función" : "Eliminar definitivamente"}</button></div>
      </form>
    </section></div>}
  </>;
}
