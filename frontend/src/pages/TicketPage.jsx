import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import client from "../api/client";
import { Spinner } from "../components/ui";

export default function TicketPage() {
  const { ticketId } = useParams();
  const [ticket, setTicket] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client
      .get(`/api/tickets/${ticketId}`)
      .then(({ data }) => setTicket(data.data))
      .catch(() => setNotFound(true));
  }, [ticketId]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-bg text-text flex items-center justify-center">
        <p className="text-muted">Ticket not found.</p>
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg text-text flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl overflow-hidden">
        {ticket.event.logo && <img src={ticket.event.logo} alt="" className="w-full h-32 object-cover" />}

        <div className="p-6 text-center">
          <p className="text-xs uppercase tracking-wide text-muted mb-1">{ticket.event.name}</p>
          <h1 className="text-xl font-bold mb-1">{ticket.registration.customFields?.name || "Attendee"}</h1>
          <p className="text-sm text-muted mb-6">{ticket.ticketType}</p>

          <p className="font-mono text-xs text-muted mb-4">{ticket.ticketId}</p>

          <div className="bg-white p-4 rounded-xl inline-block mb-6">
            <QRCodeSVG value={ticket.ticketId} size={240} level="H" />
          </div>

          {ticket.event.venue && <p className="text-sm">{ticket.event.venue}</p>}
          {ticket.event.startDate && (
            <p className="text-sm text-muted">{new Date(ticket.event.startDate).toLocaleDateString()}</p>
          )}

          <div className="mt-6 inline-flex items-center gap-2 text-success text-sm font-medium">
            <span>✓</span> {ticket.status === "ACTIVE" ? "Confirmed" : ticket.status}
          </div>
        </div>
      </div>
    </div>
  );
}