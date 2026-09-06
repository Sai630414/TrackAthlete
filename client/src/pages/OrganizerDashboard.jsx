import { useEffect, useState } from 'react'; import { Navigate } from 'react-router-dom'; import { useAuth } from '../context/AuthContext'; import api from '../services/api';
const blankSport={sportName:'',competitionType:'individual',resultType:'positions',feeType:'free',feeAmount:0,minimumTeamSize:'',maximumTeamSize:''};
const tags=sports=><div className="flex flex-wrap gap-1">{sports.map(s=><span key={s._id||s.sportName} className="px-2 py-1 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-bold">{s.sportName.toUpperCase()}</span>)}</div>;
export default function OrganizerDashboard(){const {user,logout}=useAuth();const [tab,setTab]=useState('add'),[events,setEvents]=useState([]),[ledger,setLedger]=useState([]),[message,setMessage]=useState('');const [form,setForm]=useState({eventName:'',description:'',eventDate:'',registrationDeadline:'',teamFormationDeadline:'',resultSubmissionDeadline:'',venue:'',venueAddress:{city:''},rules:'',sports:[{...blankSport}]});const load=async()=>{try{const [e,l]=await Promise.all([api.get('/organizer/events'),api.get('/organizer/ledger')]);setEvents(e.data.events||[]);setLedger(l.data.entries||[])}catch(e){setMessage(e.response?.data?.error||'Could not load organizer data.')}};useEffect(()=>{load()},[]);const sport=(i,k,v)=>setForm(f=>({...f,sports:f.sports.map((s,x)=>x===i?{...s,[k]:v}:s)}));async function create(e){e.preventDefault();try{await api.post('/organizer/events',{...form,sports:form.sports.map(s=>({...s,minimumTeamSize:Number(s.minimumTeamSize)||undefined,maximumTeamSize:Number(s.maximumTeamSize)||undefined,feeAmount:Number(s.feeAmount)||0}))});setMessage('Event published.');setForm({...form,eventName:'',sports:[{...blankSport}]});load()}catch(e){setMessage(e.response?.data?.error||'Unable to publish event.')}}if(!user||user.role!=='organizer')return <Navigate to="/organizer/login" replace/>;return <div className="min-h-screen bg-[#f7f8f4] p-5 md:p-10 text-[#173235]"><header className="flex justify-between mb-8"><div><p className="eyebrow">ORGANIZER DASHBOARD · {user.organizerId}</p><h1 className="text-3xl font-bold">Welcome, {user.name}</h1></div><button onClick={logout} className="px-4 py-2 rounded bg-white border">Sign out</button></header><nav className="flex flex-wrap gap-2 mb-6">{[['add','Add Event'],['registrations','Registrations Received'],['results','Upload Results'],['ledger','Ledger View']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'px-4 py-2 rounded font-bold '+(tab===id?'bg-[#194e42] text-white':'bg-white border')}>{label}</button>)}</nav>{message&&<p className="mb-4 p-3 rounded bg-[#e2eee4]">{message}</p>}{tab==='add'&&<form onSubmit={create} className="max-w-4xl bg-white rounded-xl p-6 space-y-4"><h2 className="text-xl font-bold">Create organizer event</h2><input required className="w-full border p-2 rounded" placeholder="Event name" value={form.eventName} onChange={e=>setForm({...form,eventName:e.target.value})}/><div className="grid md:grid-cols-3 gap-3">{[['eventDate','Event date'],['registrationDeadline','Registration deadline'],['resultSubmissionDeadline','Result submission deadline']].map(([k,l])=><label key={k}>{l}<input required className="block w-full border p-2 rounded" type="datetime-local" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div><input required className="w-full border p-2 rounded" placeholder="Event venue / conducting location" value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/><h3 className="font-bold">Sports included</h3>{form.sports.map((s,i)=><div key={i} className="border rounded p-3 grid md:grid-cols-3 gap-2"><input required className="border p-2 rounded" placeholder="Sport name" value={s.sportName} onChange={e=>sport(i,'sportName',e.target.value)}/><select className="border p-2 rounded" value={s.competitionType} onChange={e=>sport(i,'competitionType',e.target.value)}><option value="individual">Individual</option><option value="team">Team</option></select><select className="border p-2 rounded" value={s.resultType} onChange={e=>sport(i,'resultType',e.target.value)}><option value="positions">Positions</option><option value="medals">Gold / Silver / Bronze</option></select><select className="border p-2 rounded" value={s.feeType} onChange={e=>sport(i,'feeType',e.target.value)}><option value="free">Free</option><option value="per_participant">Per Participant</option><option value="per_team">Per Team</option></select>{s.competitionType==='team'&&<><input required type="number" min="1" className="border p-2 rounded" placeholder="Minimum team size" value={s.minimumTeamSize} onChange={e=>sport(i,'minimumTeamSize',e.target.value)}/><input required type="number" min="1" className="border p-2 rounded" placeholder="Maximum team size" value={s.maximumTeamSize} onChange={e=>sport(i,'maximumTeamSize',e.target.value)}/></>}<input type="number" min="0" className="border p-2 rounded" placeholder="Fee amount" value={s.feeAmount} onChange={e=>sport(i,'feeAmount',e.target.value)}/><button type="button" onClick={()=>setForm({...form,sports:form.sports.filter((_,x)=>x!==i)})}>Remove</button></div>)}<button type="button" className="border p-2 rounded" onClick={()=>setForm({...form,sports:[...form.sports,{...blankSport}]})}>+ Add Sport</button><button className="block bg-[#e07050] text-white px-5 py-2 rounded font-bold">Publish Event</button></form>}{tab==='registrations'&&<RegistrationView events={events}/>} {tab==='results'&&<ResultsView events={events} onMessage={setMessage} onDone={load}/>} {tab==='ledger'&&<section className="space-y-3">{ledger.map(e=><article key={e._id} className="bg-white p-4 rounded"><b>{e.eventName}</b>{tags(e.sports)}<p>{e.registrationCount} registrations · {e.teamCount||0} teams · {e.frozenSports} frozen · {e.pendingSports} pending</p></article>)}</section>}</div>}
function RegistrationView({events}){
  const [selected,setSelected]=useState(null), [data,setData]=useState(null), [sport,setSport]=useState('');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailMessage, setEmailMessage] = useState('');
  const [emailStatus, setEmailStatus] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  async function open(event){
    setSelected(event); setSport(''); setData(null); setShowEmailModal(false); setEmailStatus('');
    const r=await api.get(`/organizer/events/${event._id}/registrations`);
    setData(r.data);
  }

  async function sendUpdates(e){
    e.preventDefault();
    if (!emailSubject.trim() || !emailMessage.trim()) return;
    setSendingEmail(true); setEmailStatus('');
    try {
      const res = await api.post(`/organizer/events/${selected._id}/updates`, {
        subject: emailSubject.trim(),
        message: emailMessage.trim(),
        sportConfigId: sport || undefined
      });
      setEmailStatus(`✓ Event update successfully emailed to ${res.data.sent} participant(s) via Brevo.`);
      setEmailSubject('');
      setEmailMessage('');
    } catch(err){
      setEmailStatus(err.response?.data?.error || 'Failed to send event update email.');
    } finally {
      setSendingEmail(false);
    }
  }

  const shown=data?.registrations.filter(r=>!sport||String(r.sportConfigId)===sport)||[];

  return (
    <section className="space-y-4">
      {events.map(e => (
        <article key={e._id} className="bg-white p-5 rounded-xl border border-[#d8ded5] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <b className="text-base text-[#173235]">{e.eventName}</b>
            <div className="mt-1">{tags(e.sports)}</div>
          </div>
          <button className="px-4 py-2 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer hover:bg-[#143d34] self-start sm:self-auto" onClick={()=>open(e)}>
            View Registrations
          </button>
        </article>
      ))}

      {selected && data && (
        <article className="bg-white p-6 rounded-xl border border-[#d8ded5] shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4">
            <div>
              <h2 className="font-extrabold text-lg text-[#173235]">{selected.eventName} — Registrations Received</h2>
              <p className="text-xs text-[#526668]">Total Registrations: <strong>{data.registrations.length}</strong></p>
            </div>
            <button
              type="button"
              onClick={() => { setShowEmailModal(!showEmailModal); setEmailStatus(''); }}
              className="px-4 py-2 rounded-lg bg-[#e07050] text-white text-xs font-bold cursor-pointer hover:bg-[#c95d3e]"
            >
              ✉ Email Participant Updates
            </button>
          </div>

          {showEmailModal && (
            <form onSubmit={sendUpdates} className="p-4 bg-[#f8faf7] border border-[#2f6d5a] rounded-xl space-y-3">
              <h4 className="font-bold text-xs text-[#194e42] uppercase tracking-wider">
                Send Participant Update via Brevo ({sport ? `Filtered Sport: ${selected.sports.find(s=>String(s._id)===sport)?.sportName?.toUpperCase()}` : 'All Event Participants'})
              </h4>
              {emailStatus && (
                <div className="p-2.5 rounded-lg text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                  {emailStatus}
                </div>
              )}
              <input
                required
                type="text"
                placeholder="Email Subject (e.g. Tournament Reporting Time & Schedule)"
                value={emailSubject}
                onChange={e=>setEmailSubject(e.target.value)}
                className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs text-[#173235] bg-white"
              />
              <textarea
                required
                rows={3}
                placeholder="Write your update message to participants here…"
                value={emailMessage}
                onChange={e=>setEmailMessage(e.target.value)}
                className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs text-[#173235] bg-white"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={()=>setShowEmailModal(false)} className="px-3 py-1.5 border rounded-lg text-xs font-bold text-[#526668] cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={sendingEmail} className="px-4 py-1.5 rounded-lg bg-[#194e42] text-white text-xs font-bold cursor-pointer disabled:opacity-50">
                  {sendingEmail ? 'Sending via Brevo…' : 'Send Update Now'}
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap gap-2 my-3">
            <button
              onClick={()=>setSport('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${!sport ? 'bg-[#194e42] text-white' : 'bg-white border text-[#173235]'}`}
            >
              All ({data.registrations.length})
            </button>
            {selected.sports.map(s => (
              <button
                key={s._id}
                onClick={()=>setSport(String(s._id))}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition ${sport===String(s._id) ? 'bg-[#194e42] text-white' : 'bg-white border text-[#173235]'}`}
              >
                [{s.sportName.toUpperCase()}] ({data.registrations.filter(r=>String(r.sportConfigId)===String(s._id)).length})
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-xs text-[#697c7c] py-4 text-center border border-dashed rounded-lg">No registrations received for this sport yet.</p>
          ) : (
            <div className="space-y-3">
              {shown.map(r => {
                const isTeam = r.type === 'team';
                const team = r.team;
                const sportCfg = selected.sports?.find(s => String(s._id) === String(r.sportConfigId));
                return (
                  <div key={r._id} className="border border-[#d8ded5] p-4 rounded-xl text-xs space-y-2 bg-white shadow-2xs">
                    <div className="flex flex-wrap justify-between items-start gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#e2eee4] text-[#194e42] font-extrabold uppercase border border-[#2f6d5a] text-[10px]">
                          [{sportCfg?.sportName?.toUpperCase() || 'SPORT'}]
                        </span>
                        <span className="px-2 py-0.5 rounded bg-[#f4f8f5] text-[#173235] font-bold border text-[10px] uppercase">
                          {r.type}
                        </span>
                        <b className="text-sm text-[#173235]">
                          {isTeam ? `Team: ${team?.name || 'Unnamed Team'}` : r.athlete?.name}
                        </b>
                      </div>
                      <span className="px-2.5 py-0.5 rounded bg-[#e2eee4] text-[#194e42] font-bold text-[11px] border">
                        Status: {String(r.status).replaceAll('_', ' ').toUpperCase()}
                      </span>
                    </div>

                    {!isTeam ? (
                      <div className="text-[#526668] space-y-0.5">
                        <div>Athlete ID: <strong>{r.athlete?.athleteId || '—'}</strong> · Email: {r.athlete?.email || '—'} · Mobile: {r.athlete?.contactPhone || '—'}</div>
                        <div>Registered Date: {r.createdAt ? new Date(r.createdAt).toLocaleDateString('en-IN') : '—'}</div>
                      </div>
                    ) : (
                      <div className="space-y-1.5 pt-1 text-[#526668]">
                        <div>
                          Captain: <strong>{team?.captain?.name || 'Athlete'}</strong> ({team?.captain?.athleteId || '—'}) · {team?.captain?.email || ''} · {team?.captain?.contactPhone || ''}
                        </div>
                        {team?.members?.length > 0 && (
                          <div>
                            <strong className="text-[#173235]">Registered TrackAthlete Members:</strong>{' '}
                            {team.members.map(m => `${m.athlete?.name || 'Member'} (${m.athlete?.athleteId || 'Athlete'}) [${m.status}]`).join(', ')}
                          </div>
                        )}
                        {team?.manualPlayers?.length > 0 && (
                          <div className="bg-[#fff8ea] p-2 rounded-lg border border-[#e0c068] text-[#9a6c00]">
                            <strong>External / Manual Players ({team.manualPlayers.length}):</strong>{' '}
                            {team.manualPlayers.map(p => `${p.name} (Mobile: ${p.mobile}${p.email ? ` · ${p.email}` : ''})`).join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </article>
      )}
    </section>
  );
}
function ResultsView({ events, onMessage, onDone }) {
  const [pick, setPick] = useState(null); const [teams, setTeams] = useState([]); const [entries, setEntries] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(''); const [position, setPosition] = useState(''); const [medal, setMedal] = useState('');
  const [individual, setIndividual] = useState({ name: '', aadhaar: '', mobile: '' }); const [certificate, setCertificate] = useState(null); const [busy, setBusy] = useState(false);
  const resultType = pick?.sport?.resultType || 'positions'; const selectedTeam = teams.find(team => String(team._id) === selectedTeamId);
  const rosterFor = team => [
    ...(team?.members || []).filter(member => member.status === 'confirmed').map(member => ({ participantType: 'registered', name: member.athlete?.name || 'Registered athlete', mobile: member.athlete?.contactPhone || '—', email: member.athlete?.email || '', isCaptain: String(member.athlete?._id || member.athlete) === String(team.captain?._id || team.captain) })),
    ...(team?.manualPlayers || []).map(player => ({ participantType: 'manual', name: player.name, mobile: player.mobile || '—', email: player.email || '', isCaptain: false }))
  ];
  const openSport = async (event, sport) => {
    setPick({ event, sport }); setTeams([]); setEntries([]); setSelectedTeamId(''); setPosition(''); setMedal(''); setCertificate(null); setIndividual({ name: '', aadhaar: '', mobile: '' });
    try {
      const [registrations, saved] = await Promise.all([
        sport.competitionType === 'team' ? api.get(`/organizer/events/${event._id}/registrations`) : Promise.resolve({ data: { registrations: [] } }),
        api.get(`/organizer/events/${event._id}/results/${sport._id}`)
      ]);
      const registeredTeams = [...new Map((registrations.data.registrations || []).filter(row => String(row.sportConfigId) === String(sport._id) && row.team && row.team.status !== 'terminated').map(row => [row.team._id, row.team])).values()];
      setTeams(registeredTeams); setEntries(saved.data.result?.entries || []);
      if (saved.data.result?.certificateData) setCertificate({ data: saved.data.result.certificateData, name: saved.data.result.certificateFileName, size: saved.data.result.certificateFileSize });
    } catch (error) { onMessage(error.response?.data?.error || 'Could not load this sport result.'); }
  };
  const pickCertificate = file => {
    if (!file) return; if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) return onMessage('Certificate must be a PDF file.');
    if (file.size > 1024 * 1024) return onMessage('Certificate PDF must be no larger than 1 MB.');
    const reader = new FileReader(); reader.onload = () => setCertificate({ data: reader.result, name: file.name, size: file.size }); reader.readAsDataURL(file);
  };
  const addEntry = () => {
    if (!pick) return; const resultFields = resultType === 'positions' ? { position: Number(position) } : { medal };
    if (resultType === 'positions' && (!Number(position) || Number(position) < 1)) return onMessage('Select a valid finishing position.');
    if (resultType === 'medals' && !medal) return onMessage('Select a medal result.');
    if (pick.sport.competitionType === 'team') {
      if (!selectedTeam) return onMessage('Select a registered team.'); if (entries.some(entry => String(entry.team) === String(selectedTeam._id))) return onMessage('This team is already included in the draft.');
      const roster = rosterFor(selectedTeam); if (!roster.length) return onMessage('This team has no confirmed members to include.');
      setEntries([...entries, { team: selectedTeam._id, teamName: selectedTeam.name, name: selectedTeam.name, roster, ...resultFields }]); setSelectedTeamId('');
    } else {
      if (!individual.name.trim() || !individual.aadhaar.trim()) return onMessage('Participant name and Aadhaar are required for secure individual matching.');
      setEntries([...entries, { ...individual, name: individual.name.trim(), ...resultFields }]); setIndividual({ name: '', aadhaar: '', mobile: '' });
    }
    setPosition(''); setMedal('');
  };
  const save = async freeze => {
    if (!pick || busy) return; if (freeze && !certificate?.data) return onMessage('Certificate PDF is required before publishing the result.');
    setBusy(true); try {
      await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}`, { resultType, entries, certificateData: certificate?.data, certificateFileName: certificate?.name, certificateFileSize: certificate?.size });
      if (freeze) await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}/freeze`);
      onMessage(freeze ? `${pick.sport.sportName} is now Organizer Verified and frozen.` : 'Result draft saved.'); await onDone();
      if (freeze) setPick(current => ({ ...current, sport: { ...current.sport, resultStatus: 'frozen' } }));
      else await openSport(pick.event, pick.sport);
    } catch (error) { onMessage(error.response?.data?.error || 'Could not save this result.'); } finally { setBusy(false); }
  };
  const frozen = pick?.sport?.resultStatus === 'frozen';
  return <section className="space-y-4">
    {events.map(event => <article key={event._id} className="bg-white p-5 rounded-xl border border-[#d8ded5] shadow-sm"><b className="text-[#173235]">{event.eventName}</b><div className="flex flex-wrap gap-2 mt-3">{event.sports.map(sport => <button onClick={() => openSport(event, sport)} key={sport._id} className={`border px-3 py-2 rounded-lg text-xs font-bold ${sport.resultStatus === 'frozen' ? 'bg-[#e2eee4] border-[#2f6d5a] text-[#194e42]' : 'bg-white hover:bg-[#f4f8f5]'}`}>{sport.sportName.toUpperCase()} · {sport.competitionType} · {sport.resultStatus === 'frozen' ? 'ORGANIZER VERIFIED' : 'UPLOAD RESULTS'}</button>)}</div></article>)}
    {pick && <article className="bg-white rounded-xl border border-[#d8ded5] shadow-sm overflow-hidden"><div className="p-6 bg-[#173235] text-white"><p className="text-[10px] font-bold tracking-wider text-[#d9eee5]">{frozen ? 'ORGANIZER VERIFIED' : 'UPLOAD RESULTS'}</p><h2 className="text-xl font-extrabold mt-1">{pick.sport.sportName.toUpperCase()} RESULT</h2><p className="text-sm text-[#d9eee5]">{pick.event.eventName}</p></div><div className="p-5 md:p-6 space-y-6">
      <div className="grid sm:grid-cols-2 gap-3 text-xs"><div className="rounded-lg bg-[#f4f8f5] p-3"><span className="block text-[#697c7c]">Sport</span><b>{pick.sport.sportName.toUpperCase()}</b></div><div className="rounded-lg bg-[#f4f8f5] p-3"><span className="block text-[#697c7c]">Result Type</span><b>{resultType === 'positions' ? 'POSITIONS' : 'GOLD / SILVER / BRONZE'}</b></div></div>
      {frozen ? <div className="space-y-4"><div className="p-3 rounded-lg bg-[#e2eee4] border border-[#2f6d5a] text-sm font-bold text-[#194e42]">ORGANIZER VERIFIED · This sport is frozen. Other sports remain editable.</div>{entries.map((entry, index) => <ResultEntryCard key={entry._id || index} entry={entry} resultType={resultType} index={index} certificate={certificate} />)}</div> : <>
        {pick.sport.competitionType === 'team' ? <><label className="block text-xs font-bold">Selected Team<select className="mt-1.5 w-full border border-[#d2dad2] p-2.5 rounded-lg bg-white" value={selectedTeamId} onChange={event => setSelectedTeamId(event.target.value)}><option value="">Choose a registered team</option>{teams.map(team => <option key={team._id} value={team._id}>{team.name} · {team.status}</option>)}</select></label>{selectedTeam && <RosterTable team={selectedTeam} roster={rosterFor(selectedTeam)} />}</> : <div className="grid sm:grid-cols-3 gap-3"><input className="border p-2.5 rounded-lg" placeholder="Participant name" value={individual.name} onChange={event => setIndividual({ ...individual, name: event.target.value })}/><input className="border p-2.5 rounded-lg" placeholder="Aadhaar (secure matching)" value={individual.aadhaar} onChange={event => setIndividual({ ...individual, aadhaar: event.target.value })}/><input className="border p-2.5 rounded-lg" placeholder="Mobile" value={individual.mobile} onChange={event => setIndividual({ ...individual, mobile: event.target.value })}/></div>}
        <div className="rounded-xl border border-[#d8ded5] p-4"><h3 className="font-extrabold text-sm">TOURNAMENT RESULT</h3><div className="mt-3 flex flex-col sm:flex-row gap-3 items-end">{resultType === 'positions' ? <label className="text-xs font-bold flex-1">Final Position<select className="block mt-1.5 w-full border p-2.5 rounded-lg" value={position} onChange={event => setPosition(event.target.value)}><option value="">Select finishing position</option>{Array.from({ length: 20 }, (_, index) => index + 1).map(rank => <option key={rank} value={rank}>{rank}{rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} Place</option>)}</select></label> : <label className="text-xs font-bold flex-1">Medal<select className="block mt-1.5 w-full border p-2.5 rounded-lg" value={medal} onChange={event => setMedal(event.target.value)}><option value="">Select medal</option><option>Gold</option><option>Silver</option><option>Bronze</option></select></label>}<button type="button" onClick={addEntry} className="px-4 py-2.5 rounded-lg bg-[#194e42] text-white text-xs font-bold">Add Result</button></div></div>
        {entries.length > 0 && <div className="space-y-3"><h3 className="font-extrabold text-sm">DRAFT RESULTS ({entries.length})</h3>{entries.map((entry, index) => <div key={entry._id || index} className="border rounded-lg p-3 flex justify-between gap-3 text-xs"><div><b>{entry.teamName || entry.name}</b><span className="ml-2 text-[#194e42] font-bold">{resultType === 'positions' ? `${entry.position} place` : entry.medal}</span><p className="text-[#697c7c]">{entry.roster?.length ? `${entry.roster.length} roster members included` : 'Individual participant'}</p></div><button type="button" onClick={() => setEntries(entries.filter((_, entryIndex) => entryIndex !== index))} className="text-[#b94c35] font-bold">Remove</button></div>)}</div>}
        <div className="rounded-xl border-2 border-dashed border-[#2f6d5a] p-4"><h3 className="font-extrabold text-sm">CERTIFICATE PDF</h3><p className="text-xs text-[#697c7c] mt-1">Required to publish the official result. PDF only, maximum 1 MB.</p><input aria-label="Choose certificate PDF" className="mt-3 text-xs" type="file" accept="application/pdf,.pdf" onChange={event => pickCertificate(event.target.files?.[0])}/>{certificate && <div className="mt-3 flex items-center justify-between rounded-lg bg-[#e2eee4] p-2.5 text-xs"><span><b>{certificate.name}</b> · {Math.ceil(certificate.size / 1024)} KB</span><button type="button" onClick={() => setCertificate(null)} className="font-bold text-[#b94c35]">Remove</button></div>}</div>
        <div className="flex flex-wrap gap-3"><button type="button" disabled={busy || !entries.length} onClick={() => save(false)} className="px-4 py-2.5 rounded-lg border font-bold text-xs disabled:opacity-50">{busy ? 'Saving…' : 'SAVE DRAFT'}</button><button type="button" disabled={busy || !entries.length} onClick={() => save(true)} className="px-4 py-2.5 rounded-lg bg-[#e07050] text-white font-bold text-xs disabled:opacity-50">PUBLISH &amp; FREEZE SPORT</button></div>
      </>}</div></article>}
  </section>;
}
function RosterTable({ team, roster }) { return <div className="rounded-xl border border-[#d8ded5] overflow-hidden"><div className="p-4 bg-[#f4f8f5]"><h3 className="font-extrabold text-sm">TEAM ROSTER · {team.name}</h3><p className="text-xs text-[#697c7c] mt-1">Every confirmed registered athlete and manual player is included in this result.</p></div><div className="overflow-x-auto"><table className="w-full text-xs"><thead className="bg-white text-left text-[#526668]"><tr><th className="p-3">#</th><th className="p-3">Player</th><th className="p-3">Type</th><th className="p-3">Mobile</th><th className="p-3">Result Status</th></tr></thead><tbody>{roster.map((member, index) => <tr key={`${member.participantType}-${index}`} className="border-t"><td className="p-3">{index + 1}</td><td className="p-3 font-bold">{member.name}{member.isCaptain && <span className="ml-2 text-[10px] text-[#194e42]">CAPTAIN</span>}</td><td className="p-3">{member.participantType === 'registered' ? 'Registered Athlete' : 'Manual Player'}</td><td className="p-3">{member.mobile}</td><td className="p-3 text-[#194e42] font-bold">Included</td></tr>)}</tbody></table></div></div>; }
function ResultEntryCard({ entry, resultType, index, certificate }) { return <div className="rounded-xl border border-[#2f6d5a] overflow-hidden"><div className="p-4 bg-[#e2eee4] flex flex-wrap justify-between gap-2"><div><b>{entry.teamName || entry.name}</b><p className="text-xs text-[#526668] mt-1">{resultType === 'positions' ? `${entry.position} place` : entry.medal}</p></div><span className="text-[10px] font-extrabold text-[#194e42]">ORGANIZER VERIFIED</span></div>{entry.roster?.length > 0 && <RosterTable team={{ name: entry.teamName || entry.name }} roster={entry.roster}/>} {certificate?.data && <a href={certificate.data} target="_blank" rel="noreferrer" className="block p-3 text-xs font-bold text-[#194e42] hover:underline">View Certificate PDF</a>}</div>; }
