import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import client from "../api/client";
import { Spinner } from "../components/ui";

export default function PublicEventPage() {
  const { slug } = useParams();
  const [event, setEvent] = useState(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    client
      .get(`/api/events/public/${slug}`)
      .then(({ data }) => setEvent(data.data))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) return <Centered>Event not found.</Centered>;
  if (!event) return <Centered><Spinner /></Centered>;

  const registrationOpen = ["PUBLISHED", "REGISTRATION_OPEN"].includes(event.status);

  return (
    <div className="min-h-screen bg-bg text-text">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {event.banner && <img src={event.banner} alt="" className="w-full rounded-xl mb-8" />}
        <h1 className="text-3xl font-bold mb-2">{event.name}</h1>
        {event.venue && <p className="text-muted mb-1">{event.venue}</p>}
        {event.startDate && <p className="text-muted mb-6">{new Date(event.startDate).toLocaleDateString()}</p>}
        {event.description && <p className="text-sm leading-relaxed mb-8">{event.description}</p>}

        {registrationOpen ? (
          <Link
            to={`/events/${slug}/register`}
            className="inline-block bg-primary hover:bg-primary-dark text-white font-medium px-6 py-3 rounded-lg"
          >
            Register now
          </Link>
        ) : (
          <p className="text-muted font-medium">Registration Closed</p>
        )}
      </div>
    </div>
  );
}

function Centered({ children }) {
  return <div className="min-h-screen bg-bg text-text flex items-center justify-center">{children}</div>;
}
