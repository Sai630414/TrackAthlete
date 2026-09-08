import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
} from './ui';
import api from '../services/api';
import { Calendar, MapPin, Trophy, Shield, Clock, ExternalLink, RefreshCw, AlertCircle, Building, CheckCircle2 } from 'lucide-react';

export default function OrganizedEventsSection({ initialData = null }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState('');

  const fetchEvents = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/organizer-events/my-organized-events');
      setData(res.data);
    } catch (err) {
      console.error('Error loading organized events:', err);
      setError(err.response?.data?.error || 'Unable to load organized events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialData) {
      fetchEvents();
    } else {
      setData(initialData);
    }
  }, [initialData]);

  if (loading) {
    return (
      <Card className="border border-[#d8ded5] shadow-xs">
        <CardContent className="p-8 text-center text-xs text-[#697c7c] flex flex-col items-center justify-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-[#194e42]" />
          <span>Loading your organized events…</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-[#d8ded5] shadow-xs">
        <CardContent className="p-6 text-center text-xs text-rose-700 bg-rose-50 rounded-xl">
          <AlertCircle className="w-5 h-5 mx-auto mb-1 text-rose-500" />
          <p>{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data || !data.hasLinkedOrganizer) {
    return (
      <Card className="border border-[#d8ded5] shadow-xs">
        <CardHeader>
          <CardTitle className="text-base font-bold text-[#173235] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#cc694e]" /> Organized Events
          </CardTitle>
          <CardDescription>
            Events conducted and managed under your linked Organizer account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-8 rounded-2xl border border-dashed border-[#d8ded5] bg-[#fffefa] text-center space-y-2">
            <Calendar className="w-8 h-8 text-[#8a9d9a] mx-auto mb-1" />
            <h4 className="font-bold text-[#173235] text-sm">No Linked Organizer Account Found</h4>
            <p className="text-xs text-[#526668] max-w-md mx-auto">
              You do not have a linked Organizer profile yet. When signing up for an Organizer account, enter your TrackAthlete ID to manage and display your tournaments here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { organizer, events = [] } = data;

  return (
    <div className="space-y-4">
      {/* Linked Organizer Info Card */}
      <div className="p-5 rounded-2xl border border-[#2f6d5a]/40 bg-[#f4f8f4] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <Shield className="w-3.5 h-3.5 text-[#cc694e]" /> Linked Organizer Workspace
            </span>
            {organizer.organizerId && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-mono font-bold bg-white text-[#194e42] border border-[#2f6d5a]/40 shadow-xs">
                {organizer.organizerId}
              </span>
            )}
            <span className="text-xs text-[#526668] font-medium">
              ({organizer.organizerType || 'Organizer'})
            </span>
          </div>
          <h2 className="text-lg font-bold text-[#173235]">
            {organizer.organizationName ? `${organizer.organizationName} (${organizer.name})` : organizer.name}
          </h2>
          <p className="text-xs text-[#697c7c] mt-0.5">
            This profile is officially linked as an Event Organizer. Below are all tournaments and events organized by you.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchEvents}
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white hover:bg-[#e2eee4] text-[#194e42] text-xs font-bold border border-[#2f6d5a]/40 cursor-pointer shadow-xs self-start sm:self-auto transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Events List */}
      <Card className="border border-[#d8ded5] shadow-xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold text-[#173235] flex items-center gap-2">
              <Calendar className="w-5 h-5 text-[#cc694e]" /> Tournaments &amp; Events Created ({events.length})
            </CardTitle>
            <CardDescription>
              Dynamic list of competitive events created and published by your Organizer identity
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {events.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-[#d8ded5] bg-[#fffefa] text-center space-y-2">
              <Trophy className="w-8 h-8 text-[#8a9d9a] mx-auto mb-1" />
              <h4 className="font-bold text-[#173235] text-sm">No Events Created Yet</h4>
              <p className="text-xs text-[#526668] max-w-md mx-auto">
                You have not created any tournaments yet. Switch to your Organizer workspace to publish your first sporting event.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((evt) => {
                const eventDateStr = evt.eventDate
                  ? new Date(evt.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : 'TBD';
                const regDeadlineStr = evt.registrationDeadline
                  ? new Date(evt.registrationDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : null;

                return (
                  <div
                    key={evt._id}
                    className="p-4 rounded-2xl border border-[#d8ded5] bg-white shadow-xs flex flex-col justify-between space-y-3 hover:border-[#2f6d5a] transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#cc694e]">
                            ORGANIZED EVENT
                          </span>
                          <h3 className="font-bold text-sm text-[#173235] mt-0.5 leading-snug">
                            {evt.eventName}
                          </h3>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          evt.status === 'published' ? 'bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]/40' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {evt.status || 'Active'}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs text-[#526668]">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-[#8a9d9a] shrink-0" />
                          <span>Event Date: <b>{eventDateStr}</b></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#8a9d9a] shrink-0" />
                          <span className="truncate">{evt.venue || 'Venue TBD'}</span>
                        </div>
                        {regDeadlineStr && (
                          <div className="flex items-center gap-1.5 text-[#8a9d9a]">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>Registration Closes: {regDeadlineStr}</span>
                          </div>
                        )}
                      </div>

                      {evt.sports && evt.sports.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {evt.sports.map((sp, idx) => (
                            <span
                              key={sp._id || idx}
                              className="px-2 py-0.5 rounded bg-[#f4f8f4] text-[#194e42] border border-[#2f6d5a]/30 text-[10px] font-bold"
                            >
                              {sp.sportName} · {sp.competitionType}
                              {sp.feeType === 'free' ? ' (Free)' : ` (₹${sp.feeAmount})`}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
