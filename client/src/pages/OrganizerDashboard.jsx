import { useEffect, useState } from 'react'; import { Navigate } from 'react-router-dom'; import { useAuth } from '../context/AuthContext'; import api from '../services/api';
import { Award, Trophy, Shield, CheckCircle, AlertCircle, AlertTriangle, Trash2, Plus, FileText, Eye, Upload, Users, User, X, Check, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
const blankSport={sportName:'',competitionType:'individual',resultType:'positions',feeType:'free',feeAmount:0,minimumTeamSize:'',maximumTeamSize:''};
const tags=sports=><div className="flex flex-wrap gap-1">{sports.map(s=><span key={s._id||s.sportName} className="px-2 py-1 rounded bg-[#e2eee4] border border-[#2f6d5a] text-[10px] font-bold">{s.sportName.toUpperCase()}</span>)}</div>;
export default function OrganizerDashboard(){const {user,logout}=useAuth();const [tab,setTab]=useState('add'),[events,setEvents]=useState([]),[ledger,setLedger]=useState([]),[message,setMessage]=useState('');const [form,setForm]=useState({eventName:'',description:'',eventDate:'',registrationDeadline:'',teamFormationDeadline:'',resultSubmissionDeadline:'',venue:'',venueAddress:{city:''},rules:'',sports:[{...blankSport}]});const load=async()=>{try{const [e,l]=await Promise.all([api.get('/organizer/events'),api.get('/organizer/ledger')]);setEvents(e.data.events||[]);setLedger(l.data.entries||[])}catch(e){setMessage(e.response?.data?.error||'Could not load organizer data.')}};useEffect(()=>{load()},[]);const sport=(i,k,v)=>setForm(f=>({...f,sports:f.sports.map((s,x)=>x===i?{...s,[k]:v}:s)}));async function create(e){e.preventDefault();try{await api.post('/organizer/events',{...form,sports:form.sports.map(s=>({...s,minimumTeamSize:Number(s.minimumTeamSize)||undefined,maximumTeamSize:Number(s.maximumTeamSize)||undefined,feeAmount:Number(s.feeAmount)||0}))});setMessage('Event published.');setForm({...form,eventName:'',sports:[{...blankSport}]});load()}catch(e){setMessage(e.response?.data?.error||'Unable to publish event.')}}if(!user||user.role!=='organizer')return <Navigate to="/organizer/login" replace/>;return <div className="min-h-screen bg-[#f7f8f4] w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 text-[#173235]"><header className="flex justify-between mb-8"><div><p className="eyebrow">ORGANIZER DASHBOARD · {user.organizerId}{user.trackAthleteId ? ` · LINKED ID: ${user.trackAthleteId}` : ''}</p><h1 className="text-3xl font-bold">Welcome, {user.name}</h1></div><button onClick={logout} className="px-4 py-2 rounded bg-white border">Sign out</button></header><nav className="w-full max-w-full overflow-x-auto scrollbar-none flex flex-nowrap sm:flex-wrap gap-2 mb-6">{[['add','Add Event'],['registrations','Registrations Received'],['results','Upload Results'],['ledger','Ledger View']].map(([id,label])=><button key={id} onClick={()=>setTab(id)} className={'px-4 py-2 rounded font-bold whitespace-nowrap shrink-0 '+(tab===id?'bg-[#194e42] text-white':'bg-white border')}>{label}</button>)}</nav>{message&&<p className="mb-4 p-3 rounded bg-[#e2eee4]">{message}</p>}{tab==='add'&&<form onSubmit={create} className="max-w-4xl bg-white rounded-xl p-6 space-y-4"><h2 className="text-xl font-bold">Create organizer event</h2><input required className="w-full border p-2 rounded" placeholder="Event name" value={form.eventName} onChange={e=>setForm({...form,eventName:e.target.value})}/><div className="grid md:grid-cols-3 gap-3">{[['eventDate','Event date'],['registrationDeadline','Registration deadline'],['resultSubmissionDeadline','Result submission deadline']].map(([k,l])=><label key={k}>{l}<input required className="block w-full border p-2 rounded" type="datetime-local" value={form[k]} onChange={e=>setForm({...form,[k]:e.target.value})}/></label>)}</div><input required className="w-full border p-2 rounded" placeholder="Event venue / conducting location" value={form.venue} onChange={e=>setForm({...form,venue:e.target.value})}/><h3 className="font-bold">Sports included</h3>{form.sports.map((s,i)=><div key={i} className="border rounded p-3 grid md:grid-cols-3 gap-2"><input required className="border p-2 rounded" placeholder="Sport name" value={s.sportName} onChange={e=>sport(i,'sportName',e.target.value)}/><select className="border p-2 rounded" value={s.competitionType} onChange={e=>sport(i,'competitionType',e.target.value)}><option value="individual">Individual</option><option value="team">Team</option></select><select className="border p-2 rounded" value={s.resultType} onChange={e=>sport(i,'resultType',e.target.value)}><option value="positions">Positions</option><option value="medals">Gold / Silver / Bronze</option></select><select className="border p-2 rounded" value={s.feeType} onChange={e=>sport(i,'feeType',e.target.value)}><option value="free">Free</option><option value="per_participant">Per Participant</option><option value="per_team">Per Team</option></select>{s.competitionType==='team'&&<><input required type="number" min="1" className="border p-2 rounded" placeholder="Minimum team size" value={s.minimumTeamSize} onChange={e=>sport(i,'minimumTeamSize',e.target.value)}/><input required type="number" min="1" className="border p-2 rounded" placeholder="Maximum team size" value={s.maximumTeamSize} onChange={e=>sport(i,'maximumTeamSize',e.target.value)}/></>}<input type="number" min="0" className="border p-2 rounded" placeholder="Fee amount" value={s.feeAmount} onChange={e=>sport(i,'feeAmount',e.target.value)}/><button type="button" onClick={()=>setForm({...form,sports:form.sports.filter((_,x)=>x!==i)})}>Remove</button></div>)}<button type="button" className="border p-2 rounded" onClick={()=>setForm({...form,sports:[...form.sports,{...blankSport}]})}>+ Add Sport</button><button className="block bg-[#e07050] text-white px-5 py-2 rounded font-bold">Publish Event</button></form>}{tab==='registrations'&&<RegistrationView events={events}/>} {tab==='results'&&<ResultsView events={events} onMessage={setMessage} onDone={load}/>} {tab==='ledger'&&<section className="space-y-3">{ledger.map(e=><article key={e._id} className="bg-white p-4 rounded"><b>{e.eventName}</b>{tags(e.sports)}<p>{e.registrationCount} registrations · {e.teamCount||0} teams · {e.frozenSports} frozen · {e.pendingSports} pending</p></article>)}</section>}</div>}
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
  const [pick, setPick] = useState(null);
  const [sportConfig, setSportConfig] = useState(null);
  const [registeredTeams, setRegisteredTeams] = useState([]);
  const [entries, setEntries] = useState([]);
  const [overallCertificate, setOverallCertificate] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalPdf, setModalPdf] = useState(null);

  const readPdfFile = (file, onSuccess, onError) => {
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      onError('Only PDF files are supported for certificates.');
      return;
    }
    if (file.size > 1024 * 1024) {
      onError(`Certificate PDF (${Math.round(file.size / 1024)} KB) exceeds the 1 MB limit.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSuccess({
        data: reader.result,
        name: file.name,
        size: file.size
      });
    };
    reader.onerror = () => onError('Failed to read PDF file.');
    reader.readAsDataURL(file);
  };

  const openSport = async (event, sport) => {
    setPick({ event, sport });
    setSportConfig(sport);
    setRegisteredTeams([]);
    setEntries([]);
    setOverallCertificate(null);
    try {
      const res = await api.get(`/organizer/events/${event._id}/results/${sport._id}`);
      const saved = res.data.result;
      const sCfg = res.data.sport || sport;
      setSportConfig(sCfg);
      setRegisteredTeams(res.data.registeredTeams || []);
      setEntries(saved?.entries || []);
      if (saved?.certificateData) {
        setOverallCertificate({
          data: saved.certificateData,
          name: saved.certificateFileName || 'Sport_Certificate.pdf',
          size: saved.certificateFileSize || 0
        });
      }
    } catch (err) {
      onMessage(err.response?.data?.error || 'Could not load results for this sport.');
    }
  };

  const isFrozen = sportConfig?.resultStatus === 'frozen';
  const isTeam = sportConfig?.competitionType === 'team';
  const resultType = sportConfig?.resultType || 'positions';
  const minTeamSize = sportConfig?.minimumTeamSize || 1;
  const maxTeamSize = sportConfig?.maximumTeamSize || 50;

  // ── Team Operations ──
  const addTeamResult = () => {
    const nextPos = entries.length + 1;
    const nextMedal = entries.length === 0 ? 'Gold' : entries.length === 1 ? 'Silver' : 'Bronze';

    setEntries(prev => [
      ...prev,
      {
        teamName: '',
        position: nextPos,
        medal: nextMedal,
        roster: [],
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      }
    ]);
  };

  const removeTeamResult = (tIdx) => {
    setEntries(prev => prev.filter((_, idx) => idx !== tIdx));
  };

  const updateTeamField = (tIdx, field, value) => {
    setEntries(prev => prev.map((t, idx) => idx === tIdx ? { ...t, [field]: value } : t));
  };

  const preloadRegisteredTeam = (tIdx, regTeamId) => {
    if (!regTeamId) return;
    const regTeam = registeredTeams.find(r => String(r._id) === String(regTeamId));
    if (!regTeam) return;

    const roster = [];
    if (regTeam.captain) {
      roster.push({
        participantType: 'registered',
        athlete: regTeam.captain._id,
        athleteId: regTeam.captain.athleteId,
        name: regTeam.captain.name || 'Team Captain',
        mobile: regTeam.captain.contactPhone || '',
        email: regTeam.captain.email || '',
        isCaptain: true,
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      });
    }
    for (const m of regTeam.members || []) {
      if (m.status !== 'confirmed') continue;
      if (String(m.athlete?._id || m.athlete) === String(regTeam.captain?._id || regTeam.captain)) continue;
      roster.push({
        participantType: 'registered',
        athlete: m.athlete?._id || m.athlete,
        athleteId: m.athlete?.athleteId,
        name: m.athlete?.name || 'Registered Member',
        mobile: m.athlete?.contactPhone || '',
        email: m.athlete?.email || '',
        isCaptain: false,
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      });
    }
    for (const mp of regTeam.manualPlayers || []) {
      roster.push({
        participantType: 'manual',
        name: mp.name || 'Player',
        mobile: mp.mobile || '',
        email: mp.email || '',
        isCaptain: false,
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      });
    }

    setEntries(prev => prev.map((t, idx) => {
      if (idx !== tIdx) return t;
      return {
        ...t,
        team: regTeam._id,
        teamName: regTeam.name,
        roster: roster.length ? roster : t.roster
      };
    }));
  };

  const addPlayerRow = (tIdx) => {
    setEntries(prev => prev.map((t, idx) => {
      if (idx !== tIdx) return t;
      if (t.roster.length >= maxTeamSize) {
        onMessage(`Cannot exceed maximum team size of ${maxTeamSize} for this sport.`);
        return t;
      }
      return {
        ...t,
        roster: [
          ...t.roster,
          {
            name: '',
            isCaptain: t.roster.length === 0,
            mobile: '',
            email: '',
            aadhaar: '',
            participantType: 'offline',
            certificateData: null,
            certificateFileName: '',
            certificateFileSize: 0
          }
        ]
      };
    }));
  };

  const removePlayerRow = (tIdx, pIdx) => {
    setEntries(prev => prev.map((t, idx) => {
      if (idx !== tIdx) return t;
      return { ...t, roster: t.roster.filter((_, pi) => pi !== pIdx) };
    }));
  };

  const updatePlayerField = (tIdx, pIdx, field, value) => {
    setEntries(prev => prev.map((t, idx) => {
      if (idx !== tIdx) return t;
      const updatedRoster = t.roster.map((p, pi) => {
        if (pi !== pIdx) {
          if (field === 'isCaptain' && value === true) return { ...p, isCaptain: false };
          return p;
        }
        return { ...p, [field]: value };
      });
      return { ...t, roster: updatedRoster };
    }));
  };

  const handlePlayerPdf = (tIdx, pIdx, file) => {
    readPdfFile(file, (cert) => {
      setEntries(prev => prev.map((t, idx) => {
        if (idx !== tIdx) return t;
        return {
          ...t,
          roster: t.roster.map((p, pi) => {
            if (pi !== pIdx) return p;
            return {
              ...p,
              certificateData: cert.data,
              certificateFileName: cert.name,
              certificateFileSize: cert.size
            };
          })
        };
      }));
    }, onMessage);
  };

  const removePlayerPdf = (tIdx, pIdx) => {
    setEntries(prev => prev.map((t, idx) => {
      if (idx !== tIdx) return t;
      return {
        ...t,
        roster: t.roster.map((p, pi) => {
          if (pi !== pIdx) return p;
          return {
            ...p,
            certificateData: null,
            certificateFileName: '',
            certificateFileSize: 0
          };
        })
      };
    }));
  };

  const handleTeamPdf = (tIdx, file) => {
    readPdfFile(file, (cert) => {
      setEntries(prev => prev.map((t, idx) => idx === tIdx ? {
        ...t,
        certificateData: cert.data,
        certificateFileName: cert.name,
        certificateFileSize: cert.size
      } : t));
    }, onMessage);
  };

  // ── Individual Operations ──
  const addIndividualResult = () => {
    const nextPos = entries.length + 1;
    const nextMedal = entries.length === 0 ? 'Gold' : entries.length === 1 ? 'Silver' : 'Bronze';
    setEntries(prev => [
      ...prev,
      {
        name: '',
        position: nextPos,
        medal: nextMedal,
        mobile: '',
        email: '',
        aadhaar: '',
        participantType: 'offline',
        certificateData: null,
        certificateFileName: '',
        certificateFileSize: 0
      }
    ]);
  };

  const updateIndividualField = (idx, field, value) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const handleIndividualPdf = (idx, file) => {
    readPdfFile(file, (cert) => {
      setEntries(prev => prev.map((e, i) => i === idx ? {
        ...e,
        certificateData: cert.data,
        certificateFileName: cert.name,
        certificateFileSize: cert.size
      } : e));
    }, onMessage);
  };

  const removeIndividualResult = (idx) => {
    setEntries(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save & Freeze ──
  const handleSaveDraft = async () => {
    if (!pick || busy) return;
    if (!entries.length) {
      return onMessage('Add at least one result entry before saving a draft.');
    }
    setBusy(true);
    try {
      await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}`, {
        resultType,
        entries,
        certificateData: overallCertificate?.data || null,
        certificateFileName: overallCertificate?.name || '',
        certificateFileSize: overallCertificate?.size || 0
      });
      onMessage('✓ Result draft saved successfully. You can return anytime to continue editing.');
      await onDone();
    } catch (err) {
      onMessage(err.response?.data?.error || 'Failed to save draft.');
    } finally {
      setBusy(false);
    }
  };

  const handleFreeze = async () => {
    if (!pick || busy) return;
    if (!entries.length) {
      return onMessage('Add at least one result entry before publishing.');
    }

    // Comprehensive client-side validation
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (isTeam) {
        if (!entry.teamName?.trim()) {
          return onMessage(`Team Result #${i + 1} requires a team name.`);
        }
        const rLen = entry.roster?.length || 0;
        if (rLen < minTeamSize) {
          return onMessage(`Team "${entry.teamName}" has ${rLen} player(s). Minimum required team size for ${sportConfig.sportName.toUpperCase()} is ${minTeamSize}.`);
        }
        if (rLen > maxTeamSize) {
          return onMessage(`Team "${entry.teamName}" has ${rLen} player(s). Maximum allowed team size is ${maxTeamSize}.`);
        }
        for (let j = 0; j < entry.roster.length; j++) {
          const p = entry.roster[j];
          if (!p.name?.trim()) {
            return onMessage(`Player #${j + 1} in team "${entry.teamName}" is missing a name.`);
          }
          const hasCert = p.certificateData || entry.certificateData || overallCertificate?.data;
          if (!hasCert) {
            return onMessage(`Player "${p.name}" in team "${entry.teamName}" requires a certificate PDF (upload per-player, for the team, or as the overall sport certificate).`);
          }
        }
      } else {
        if (!entry.name?.trim()) {
          return onMessage(`Participant #${i + 1} is missing a name.`);
        }
        const hasCert = entry.certificateData || overallCertificate?.data;
        if (!hasCert) {
          return onMessage(`Participant "${entry.name}" requires a certificate PDF.`);
        }
      }
    }

    const confirmed = window.confirm(
      `Confirm Sport Result Publication:\n\nPublishing will freeze results for "${sportConfig.sportName.toUpperCase()}".\nOnce frozen, results become permanently immutable on the public ledger. Matched registered athletes will receive official certificates in their dashboard.\n\nProceed?`
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      // 1. Save draft with all latest entries
      await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}`, {
        resultType,
        entries,
        certificateData: overallCertificate?.data || null,
        certificateFileName: overallCertificate?.name || '',
        certificateFileSize: overallCertificate?.size || 0
      });

      // 2. Freeze the sport
      await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}/freeze`);

      onMessage(`✓ ${sportConfig.sportName.toUpperCase()} results successfully verified and frozen on the public ledger!`);
      await onDone();
      await openSport(pick.event, { ...pick.sport, resultStatus: 'frozen' });
    } catch (err) {
      onMessage(err.response?.data?.error || 'Failed to publish and freeze results.');
    } finally {
      setBusy(false);
    }
  };

  const handleUnfreeze = async () => {
    if (!pick || busy) return;
    const confirm = window.confirm(
      `Reopen Result for Editing?\n\nThis will unfreeze "${sportConfig.sportName.toUpperCase()}" and return it to draft mode. You will be able to modify the roster, upload certificates, and re-freeze when ready.`
    );
    if (!confirm) return;

    setBusy(true);
    try {
      await api.post(`/organizer/events/${pick.event._id}/results/${pick.sport._id}/unfreeze`);
      onMessage(`✓ ${sportConfig.sportName.toUpperCase()} results reopened for editing.`);
      await onDone();
      const updatedSport = { ...pick.sport, resultStatus: 'pending' };
      setSportConfig(updatedSport);
      setPick(prev => ({
        ...prev,
        sport: updatedSport,
        event: {
          ...prev.event,
          sports: (prev.event.sports || []).map(s => s._id === updatedSport._id ? updatedSport : s)
        }
      }));
    } catch (err) {
      onMessage(err.response?.data?.error || 'Failed to reopen results.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Event Sports Navigation Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-extrabold text-[#173235]">Organizer Competitions &amp; Results</h2>
        <p className="text-xs text-[#526668]">Select any sport below to enter tournament outcomes, team rosters, and individual certificates.</p>

        {events.map(event => (
          <article key={event._id} className="bg-white p-5 rounded-xl border border-[#d8ded5] shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <b className="text-base text-[#173235]">{event.eventName}</b>
                <p className="text-xs text-[#697c7c] mt-0.5">
                  Venue: {event.venue || 'TBA'} · Date: {event.eventDate ? new Date(event.eventDate).toLocaleDateString('en-IN') : 'TBA'}
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#526668] bg-[#f4f8f5] px-3 py-1 rounded-full border self-start sm:self-auto">
                {event.sports?.length || 0} Sport Disciplines
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {event.sports?.map(sport => {
                const isSportFrozen = sport.resultStatus === 'frozen';
                const isSelected = pick?.sport?._id === sport._id;
                return (
                  <button
                    key={sport._id}
                    type="button"
                    onClick={() => openSport(event, sport)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                      isSelected
                        ? 'bg-[#194e42] text-white border-[#194e42] shadow-sm'
                        : isSportFrozen
                        ? 'bg-[#e2eee4] border-[#2f6d5a] text-[#194e42] hover:bg-[#d5e7d8]'
                        : 'bg-white border-[#d8ded5] text-[#173235] hover:bg-[#f4f8f5]'
                    }`}
                  >
                    {isSportFrozen ? <Shield className="w-3.5 h-3.5 text-[#194e42]" /> : <Trophy className="w-3.5 h-3.5 text-[#e07050]" />}
                    <span>{sport.sportName.toUpperCase()}</span>
                    <span className="text-[10px] opacity-75">
                      ({sport.competitionType === 'team' ? `Team: ${sport.minimumTeamSize}-${sport.maximumTeamSize}` : 'Individual'})
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                      isSportFrozen ? 'bg-[#194e42] text-white' : 'bg-[#fff2e6] text-[#c95d3e]'
                    }`}>
                      {isSportFrozen ? 'FROZEN' : 'UPLOAD'}
                    </span>
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      {/* Sport Result Upload & Freeze Workspace */}
      {pick && sportConfig && (
        <article className="bg-white rounded-2xl border border-[#2f6d5a] shadow-md overflow-hidden transition-all">
          {/* Workspace Header */}
          <div className="p-6 bg-gradient-to-r from-[#173d3c] to-[#0c292c] text-white space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider border ${
                isFrozen ? 'bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]' : 'bg-[#e07050] text-white border-[#c95d3e]'
              }`}>
                {isFrozen ? '✓ ORGANIZER VERIFIED RESULT · IMMUTABLE & FROZEN' : '✎ SPORT RESULT UPLOAD & VERIFICATION'}
              </span>
              <span className="text-xs text-[#b9d9bf]">
                Event: <strong>{pick.event.eventName}</strong>
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-1">
              <div>
                <h2 className="text-2xl font-black tracking-tight">{sportConfig.sportName.toUpperCase()} TOURNAMENT OUTCOME</h2>
                <p className="text-xs text-[#b9d9bf] mt-0.5">
                  {isTeam
                    ? `Team Competition · Requires ${minTeamSize} to ${maxTeamSize} players per team roster`
                    : 'Individual Competition · 1 participant per position/medal'}
                  {' · '}Format: <strong>{resultType === 'positions' ? 'Finishing Positions (1st, 2nd, 3rd...)' : 'Medals (Gold, Silver, Bronze)'}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs px-3 py-1 rounded-lg bg-white/10 text-white font-bold border border-white/20">
                  Total Results: {entries.length}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Frozen Notice */}
            {isFrozen ? (
              <div className="p-4 rounded-xl bg-[#e2eee4] border border-[#2f6d5a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-[#194e42] shrink-0 mt-0.5" />
                  <div className="text-xs text-[#194e42]">
                    <b className="text-sm font-extrabold block">ORGANIZER VERIFIED · IMMUTABLE &amp; FROZEN</b>
                    <p className="mt-0.5">
                      This sport result is verified and permanently sealed on the public blockchain/ledger. Matched registered athletes have received their verified credentials.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleUnfreeze}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-[#e07050] hover:bg-[#c95d3e] text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs shrink-0 self-start sm:self-auto disabled:opacity-50"
                >
                  <Edit3 className="w-4 h-4" /> ✎ Reopen / Edit Result (Dev Mode)
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-[#f8faf7] border border-[#d8ded5] flex items-start gap-3">
                <Trophy className="w-5 h-5 text-[#194e42] shrink-0 mt-0.5" />
                <div className="text-xs text-[#526668]">
                  <b className="text-sm font-extrabold text-[#173235] block">Real-World Result Entry Workflow</b>
                  <p className="mt-0.5">
                    Enter the actual teams, walk-in clubs, or athletes that competed in this event. For team sports, you can optionally auto-fill from an online registered team or manually enter any external team.
                  </p>
                </div>
              </div>
            )}

            {/* ── FROZEN VIEW ── */}
            {isFrozen ? (
              <div className="space-y-4">
                {entries.map((entry, idx) => (
                  <div key={entry._id || idx} className="rounded-xl border border-[#2f6d5a] bg-white overflow-hidden shadow-xs">
                    <div className="p-4 bg-[#f4f8f5] flex flex-wrap items-center justify-between gap-3 border-b border-[#d8ded5]">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 rounded-lg bg-[#194e42] text-white font-black text-xs">
                          {resultType === 'positions' ? `${entry.position}${entry.position === 1 ? 'st' : entry.position === 2 ? 'nd' : entry.position === 3 ? 'rd' : 'th'} Place` : entry.medal}
                        </span>
                        <div>
                          <b className="text-base text-[#173235]">{entry.teamName || entry.name}</b>
                          {isTeam && (
                            <span className="ml-2 text-xs text-[#526668]">
                              ({entry.roster?.length || 0} Roster Players)
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                          ORGANIZER VERIFIED
                        </span>
                        {(entry.certificateData || overallCertificate?.data) && (
                          <button
                            type="button"
                            onClick={() => setModalPdf({
                              data: entry.certificateData || overallCertificate?.data,
                              name: entry.certificateFileName || overallCertificate?.name || 'Certificate.pdf',
                              title: `${entry.teamName || entry.name} Award Certificate`
                            })}
                            className="px-3 py-1 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" /> View Award PDF
                          </button>
                        )}
                      </div>
                    </div>

                    {isTeam && entry.roster?.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#fafbf9] text-[#526668] border-b border-[#e2eee4]">
                            <tr>
                              <th className="p-3">#</th>
                              <th className="p-3">Player Name</th>
                              <th className="p-3">Role</th>
                              <th className="p-3">Participant Type</th>
                              <th className="p-3">Contact</th>
                              <th className="p-3">Player Certificate</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entry.roster.map((player, pIdx) => {
                              const pCert = player.certificateData || entry.certificateData || overallCertificate?.data;
                              return (
                                <tr key={player._id || pIdx} className="border-b border-[#f0f4f0] hover:bg-[#fcfdfc]">
                                  <td className="p-3 text-[#697c7c] font-bold">{pIdx + 1}</td>
                                  <td className="p-3 font-bold text-[#173235]">
                                    {player.name}
                                    {player.athleteId && (
                                      <span className="ml-1.5 text-[10px] text-[#194e42] font-mono">
                                        [{player.athleteId}]
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    {player.isCaptain ? (
                                      <span className="px-2 py-0.5 rounded bg-[#194e42] text-white text-[9px] font-extrabold">CAPTAIN</span>
                                    ) : (
                                      <span className="text-[#697c7c]">Player</span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      player.participantType === 'registered' ? 'bg-[#e2eee4] text-[#194e42]' : 'bg-[#f4f8f5] text-[#526668]'
                                    }`}>
                                      {player.participantType === 'registered' ? 'Registered Athlete' : 'Offline Player'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-[#697c7c]">{player.mobile || player.email || '—'}</td>
                                  <td className="p-3">
                                    {pCert ? (
                                      <button
                                        type="button"
                                        onClick={() => setModalPdf({
                                          data: pCert,
                                          name: player.certificateFileName || `${player.name}_Certificate.pdf`,
                                          title: `${player.name} — Official Certificate`
                                        })}
                                        className="px-2.5 py-1 rounded bg-[#194e42] text-white text-[11px] font-bold hover:bg-[#143d34] transition flex items-center gap-1 cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" /> View PDF
                                      </button>
                                    ) : (
                                      <span className="text-[#697c7c] text-[10px]">No PDF</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              /* ── EDITABLE DRAFT / ENTRY VIEW ── */
              <div className="space-y-6">
                {/* TEAM MODE */}
                {isTeam ? (
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#173235]">TEAM RESULTS ({entries.length})</h3>
                        <p className="text-xs text-[#526668]">
                          Each team requires between <strong>{minTeamSize}</strong> and <strong>{maxTeamSize}</strong> players.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addTeamResult}
                        className="px-4 py-2 rounded-xl bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> + Add Team Result
                      </button>
                    </div>

                    {entries.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-[#d8ded5] rounded-2xl bg-[#fafbf9] space-y-3">
                        <Trophy className="w-10 h-10 text-[#526668] mx-auto opacity-50" />
                        <h4 className="font-extrabold text-sm text-[#173235]">No Team Results Added Yet</h4>
                        <p className="text-xs text-[#697c7c] max-w-md mx-auto">
                          Click below to add a team result (e.g. 1st Place / Winner, 2nd Place / Runner-up), specify player rosters, and upload player certificates.
                        </p>
                        <button
                          type="button"
                          onClick={addTeamResult}
                          className="px-5 py-2.5 rounded-xl bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition cursor-pointer"
                        >
                          + Add First Team Result
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {entries.map((teamEntry, tIdx) => {
                          const rLen = teamEntry.roster?.length || 0;
                          const isRosterValid = rLen >= minTeamSize && rLen <= maxTeamSize;
                          return (
                            <div
                              key={teamEntry._id || tIdx}
                              className="rounded-2xl border-2 border-[#d8ded5] hover:border-[#2f6d5a] bg-white p-5 space-y-4 shadow-sm transition"
                            >
                              {/* Team Result Header */}
                              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-full bg-[#194e42] text-white font-black text-xs flex items-center justify-center">
                                    {tIdx + 1}
                                  </span>
                                  <h4 className="font-extrabold text-sm text-[#173235]">
                                    Team Result #{tIdx + 1}
                                  </h4>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => removeTeamResult(tIdx)}
                                  className="px-3 py-1.5 rounded-lg border border-[#e57373] text-[#d32f2f] hover:bg-[#ffebee] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remove Team
                                </button>
                              </div>

                              {/* Team Metadata Form */}
                              <div className="grid sm:grid-cols-3 gap-3">
                                {/* Team Name */}
                                <div className="space-y-1 sm:col-span-1">
                                  <label className="text-xs font-bold text-[#173235] block">
                                    Team Name <span className="text-[#e07050]">*</span>
                                  </label>
                                  <input
                                    required
                                    type="text"
                                    placeholder="e.g. Royal Strikers CC"
                                    value={teamEntry.teamName}
                                    onChange={e => updateTeamField(tIdx, 'teamName', e.target.value)}
                                    className="w-full border border-[#d8ded5] p-2.5 rounded-xl text-xs bg-white text-[#173235] font-bold focus:border-[#2f6d5a] outline-none"
                                  />
                                </div>

                                {/* Finishing Rank */}
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-[#173235] block">
                                    Finishing Rank <span className="text-[#e07050]">*</span>
                                  </label>
                                  {resultType === 'positions' ? (
                                    <select
                                      value={teamEntry.position || tIdx + 1}
                                      onChange={e => updateTeamField(tIdx, 'position', Number(e.target.value))}
                                      className="w-full border border-[#d8ded5] p-2.5 rounded-xl text-xs bg-white font-bold text-[#173235] focus:border-[#2f6d5a] outline-none"
                                    >
                                      {Array.from({ length: 20 }, (_, i) => i + 1).map(rank => (
                                        <option key={rank} value={rank}>
                                          {rank}{rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} Place
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={teamEntry.medal || (tIdx === 0 ? 'Gold' : tIdx === 1 ? 'Silver' : 'Bronze')}
                                      onChange={e => updateTeamField(tIdx, 'medal', e.target.value)}
                                      className="w-full border border-[#d8ded5] p-2.5 rounded-xl text-xs bg-white font-bold text-[#173235] focus:border-[#2f6d5a] outline-none"
                                    >
                                      <option value="Gold">Gold Medal</option>
                                      <option value="Silver">Silver Medal</option>
                                      <option value="Bronze">Bronze Medal</option>
                                    </select>
                                  )}
                                </div>

                                {/* Pre-fill from registered team helper */}
                                <div className="space-y-1">
                                  <label className="text-xs font-bold text-[#526668] block">
                                    Pre-fill from Registered Team (Optional)
                                  </label>
                                  <select
                                    onChange={e => preloadRegisteredTeam(tIdx, e.target.value)}
                                    className="w-full border border-[#d8ded5] p-2.5 rounded-xl text-xs bg-[#f4f8f5] text-[#173235] focus:border-[#2f6d5a] outline-none"
                                    defaultValue=""
                                  >
                                    <option value="">— Auto-fill registered team roster —</option>
                                    {registeredTeams.map(rt => (
                                      <option key={rt._id} value={rt._id}>
                                        {rt.name} ({rt.members?.length || 0} players)
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Team-wide Certificate PDF (Optional Fallback) */}
                              <div className="p-3 bg-[#f8faf7] border border-[#d8ded5] rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                                <div>
                                  <b className="text-[#173235] block">Team Award Certificate PDF (Optional Fallback)</b>
                                  <p className="text-[#697c7c] text-[11px]">
                                    Any player on this team without an individual PDF certificate will automatically receive this certificate.
                                  </p>
                                </div>

                                {teamEntry.certificateData ? (
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 rounded bg-[#e2eee4] text-[#194e42] font-bold text-[11px] border border-[#2f6d5a]">
                                      ✓ {teamEntry.certificateFileName || 'Team_Certificate.pdf'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setModalPdf({
                                        data: teamEntry.certificateData,
                                        name: teamEntry.certificateFileName,
                                        title: `${teamEntry.teamName} Team Certificate`
                                      })}
                                      className="px-2.5 py-1 rounded bg-[#194e42] text-white font-bold text-[11px]"
                                    >
                                      Preview
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => updateTeamField(tIdx, 'certificateData', null)}
                                      className="text-[#d32f2f] font-bold text-[11px]"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    accept="application/pdf,.pdf"
                                    onChange={e => handleTeamPdf(tIdx, e.target.files?.[0])}
                                    className="text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#194e42] file:text-white hover:file:bg-[#143d34] cursor-pointer"
                                  />
                                )}
                              </div>

                              {/* Team Roster Management */}
                              <div className="space-y-3 pt-2">
                                <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f4f8f5] p-3 rounded-xl border border-[#d8ded5]">
                                  <div className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-[#194e42]" />
                                    <b className="text-xs text-[#173235]">
                                      Team Roster ({rLen} Players)
                                    </b>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                      isRosterValid
                                        ? 'bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]'
                                        : 'bg-[#fff2e6] text-[#c95d3e] border-[#e07050]'
                                    }`}>
                                      {isRosterValid
                                        ? `✓ Valid (${minTeamSize}–${maxTeamSize} required)`
                                        : rLen < minTeamSize
                                        ? `⚠️ Need ${minTeamSize - rLen} more player(s) for min ${minTeamSize}`
                                        : `❌ Exceeds maximum size of ${maxTeamSize}`}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => addPlayerRow(tIdx)}
                                      disabled={rLen >= maxTeamSize}
                                      className="px-3.5 py-1.5 rounded-lg bg-[#194e42] text-white hover:bg-[#143d34] text-xs font-bold cursor-pointer disabled:opacity-50 transition flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> + Add Team Member
                                    </button>
                                  </div>
                                </div>

                                {/* Dynamic Roster Table */}
                                {rLen === 0 ? (
                                  <div className="p-6 text-center border-2 border-dashed border-[#d8ded5] rounded-xl bg-[#fafbf9] space-y-2">
                                    <p className="text-xs text-[#697c7c]">No team members added yet.</p>
                                    <button
                                      type="button"
                                      onClick={() => addPlayerRow(tIdx)}
                                      className="px-4 py-2 rounded-xl bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                      <Plus className="w-3.5 h-3.5" /> + Add First Team Member
                                    </button>
                                  </div>
                                ) : (
                                <div className="overflow-x-auto border border-[#d8ded5] rounded-xl">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-[#fafbf9] text-[#526668] border-b border-[#d8ded5]">
                                      <tr>
                                        <th className="p-2.5 text-center w-10">#</th>
                                        <th className="p-2.5 min-w-[150px]">Player Name *</th>
                                        <th className="p-2.5 text-center w-16">Captain</th>
                                        <th className="p-2.5 min-w-[120px]">Mobile</th>
                                        <th className="p-2.5 min-w-[130px]">Email</th>
                                        <th className="p-2.5 min-w-[140px]">
                                          Aadhaar <span className="font-normal text-[10px] text-[#697c7c]">(Private)</span>
                                        </th>
                                        <th className="p-2.5 min-w-[210px]">Individual Certificate PDF</th>
                                        <th className="p-2.5 text-center w-12">Del</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {teamEntry.roster?.map((player, pIdx) => (
                                        <tr key={pIdx} className="border-b border-[#f0f4f0] hover:bg-[#fcfdfc]">
                                          <td className="p-2.5 text-center text-[#697c7c] font-bold">
                                            {pIdx + 1}
                                          </td>
                                          <td className="p-2.5">
                                            <input
                                              required
                                              type="text"
                                              placeholder="Full Player Name"
                                              value={player.name}
                                              onChange={e => updatePlayerField(tIdx, pIdx, 'name', e.target.value)}
                                              className="w-full border border-[#d8ded5] p-1.5 rounded-lg text-xs bg-white text-[#173235] font-bold focus:border-[#2f6d5a] outline-none"
                                            />
                                          </td>
                                          <td className="p-2.5 text-center">
                                            <input
                                              type="checkbox"
                                              checked={Boolean(player.isCaptain)}
                                              onChange={e => updatePlayerField(tIdx, pIdx, 'isCaptain', e.target.checked)}
                                              className="w-4 h-4 accent-[#194e42] cursor-pointer"
                                              title="Designate as Team Captain"
                                            />
                                          </td>
                                          <td className="p-2.5">
                                            <input
                                              type="text"
                                              placeholder="Mobile"
                                              value={player.mobile || ''}
                                              onChange={e => updatePlayerField(tIdx, pIdx, 'mobile', e.target.value)}
                                              className="w-full border border-[#d8ded5] p-1.5 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none"
                                            />
                                          </td>
                                          <td className="p-2.5">
                                            <input
                                              type="email"
                                              placeholder="Email"
                                              value={player.email || ''}
                                              onChange={e => updatePlayerField(tIdx, pIdx, 'email', e.target.value)}
                                              className="w-full border border-[#d8ded5] p-1.5 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none"
                                            />
                                          </td>
                                          <td className="p-2.5">
                                            <input
                                              type="text"
                                              maxLength={12}
                                              placeholder="12 digits"
                                              value={player.aadhaar || ''}
                                              onChange={e => updatePlayerField(tIdx, pIdx, 'aadhaar', e.target.value.replace(/\D/g, ''))}
                                              className="w-full border border-[#d8ded5] p-1.5 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none font-mono"
                                              title="12-digit Aadhaar for secure HMAC hash matching of registered athletes"
                                            />
                                          </td>
                                          <td className="p-2.5">
                                            {player.certificateData ? (
                                              <div className="flex items-center gap-1.5">
                                                <span className="truncate max-w-[110px] text-[10px] font-bold text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded border border-[#2f6d5a]" title={player.certificateFileName}>
                                                  ✓ {player.certificateFileName || 'PDF'}
                                                </span>
                                                <button
                                                  type="button"
                                                  onClick={() => setModalPdf({
                                                    data: player.certificateData,
                                                    name: player.certificateFileName,
                                                    title: `${player.name} Certificate`
                                                  })}
                                                  className="p-1 rounded bg-[#194e42] text-white hover:bg-[#143d34] cursor-pointer"
                                                  title="Preview PDF"
                                                >
                                                  <Eye className="w-3 h-3" />
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => removePlayerPdf(tIdx, pIdx)}
                                                  className="p-1 rounded text-[#d32f2f] hover:bg-[#ffebee] cursor-pointer"
                                                  title="Remove PDF"
                                                >
                                                  <X className="w-3 h-3" />
                                                </button>
                                              </div>
                                            ) : (
                                              <input
                                                type="file"
                                                accept="application/pdf,.pdf"
                                                onChange={e => handlePlayerPdf(tIdx, pIdx, e.target.files?.[0])}
                                                className="text-[11px] file:mr-1 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-[#e2eee4] file:text-[#194e42] hover:file:bg-[#d5e7d8] cursor-pointer"
                                              />
                                            )}
                                          </td>
                                          <td className="p-2.5 text-center">
                                            <button
                                              type="button"
                                              onClick={() => removePlayerRow(tIdx, pIdx)}
                                              className="p-1 rounded text-[#697c7c] hover:text-[#d32f2f] hover:bg-[#ffebee] cursor-pointer"
                                              title="Remove row"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* INDIVIDUAL MODE */
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-[#173235]">PARTICIPANT RESULTS ({entries.length})</h3>
                        <p className="text-xs text-[#526668]">
                          Enter individual athlete placements, contact/Aadhaar matching, and certificate PDFs.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={addIndividualResult}
                        className="px-4 py-2 rounded-xl bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition flex items-center gap-2 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" /> + Add Participant Result
                      </button>
                    </div>

                    {entries.length === 0 ? (
                      <div className="p-8 text-center border-2 border-dashed border-[#d8ded5] rounded-2xl bg-[#fafbf9] space-y-3">
                        <User className="w-10 h-10 text-[#526668] mx-auto opacity-50" />
                        <h4 className="font-extrabold text-sm text-[#173235]">No Participant Results Added</h4>
                        <p className="text-xs text-[#697c7c] max-w-md mx-auto">
                          Click below to add competitors, assign medals or finishing ranks, and attach certificate PDFs.
                        </p>
                        <button
                          type="button"
                          onClick={addIndividualResult}
                          className="px-5 py-2.5 rounded-xl bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition cursor-pointer"
                        >
                          + Add First Participant
                        </button>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-[#d8ded5] rounded-xl">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-[#fafbf9] text-[#526668] border-b border-[#d8ded5]">
                            <tr>
                              <th className="p-3 text-center w-12">#</th>
                              <th className="p-3 min-w-[160px]">Participant Name *</th>
                              <th className="p-3 min-w-[130px]">Rank / Medal *</th>
                              <th className="p-3 min-w-[120px]">Mobile</th>
                              <th className="p-3 min-w-[130px]">Email</th>
                              <th className="p-3 min-w-[140px]">
                                Aadhaar <span className="font-normal text-[10px] text-[#697c7c]">(Private)</span>
                              </th>
                              <th className="p-3 min-w-[210px]">Certificate PDF</th>
                              <th className="p-3 text-center w-12">Del</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entries.map((entry, idx) => (
                              <tr key={entry._id || idx} className="border-b border-[#f0f4f0] hover:bg-[#fcfdfc]">
                                <td className="p-3 text-center font-bold text-[#697c7c]">{idx + 1}</td>
                                <td className="p-3">
                                  <input
                                    required
                                    type="text"
                                    placeholder="Full Name"
                                    value={entry.name || ''}
                                    onChange={e => updateIndividualField(idx, 'name', e.target.value)}
                                    className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white text-[#173235] font-bold focus:border-[#2f6d5a] outline-none"
                                  />
                                </td>
                                <td className="p-3">
                                  {resultType === 'positions' ? (
                                    <select
                                      value={entry.position || idx + 1}
                                      onChange={e => updateIndividualField(idx, 'position', Number(e.target.value))}
                                      className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white font-bold text-[#173235] focus:border-[#2f6d5a] outline-none"
                                    >
                                      {Array.from({ length: 20 }, (_, i) => i + 1).map(rank => (
                                        <option key={rank} value={rank}>
                                          {rank}{rank === 1 ? 'st' : rank === 2 ? 'nd' : rank === 3 ? 'rd' : 'th'} Place
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <select
                                      value={entry.medal || (idx === 0 ? 'Gold' : idx === 1 ? 'Silver' : 'Bronze')}
                                      onChange={e => updateIndividualField(idx, 'medal', e.target.value)}
                                      className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white font-bold text-[#173235] focus:border-[#2f6d5a] outline-none"
                                    >
                                      <option value="Gold">Gold Medal</option>
                                      <option value="Silver">Silver Medal</option>
                                      <option value="Bronze">Bronze Medal</option>
                                    </select>
                                  )}
                                </td>
                                <td className="p-3">
                                  <input
                                    type="text"
                                    placeholder="Mobile"
                                    value={entry.mobile || ''}
                                    onChange={e => updateIndividualField(idx, 'mobile', e.target.value)}
                                    className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none"
                                  />
                                </td>
                                <td className="p-3">
                                  <input
                                    type="email"
                                    placeholder="Email"
                                    value={entry.email || ''}
                                    onChange={e => updateIndividualField(idx, 'email', e.target.value)}
                                    className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none"
                                  />
                                </td>
                                <td className="p-3">
                                  <input
                                    type="text"
                                    maxLength={12}
                                    placeholder="12 digits"
                                    value={entry.aadhaar || ''}
                                    onChange={e => updateIndividualField(idx, 'aadhaar', e.target.value.replace(/\D/g, ''))}
                                    className="w-full border border-[#d8ded5] p-2 rounded-lg text-xs bg-white text-[#173235] focus:border-[#2f6d5a] outline-none font-mono"
                                  />
                                </td>
                                <td className="p-3">
                                  {entry.certificateData ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="truncate max-w-[110px] text-[10px] font-bold text-[#194e42] bg-[#e2eee4] px-2 py-0.5 rounded border border-[#2f6d5a]" title={entry.certificateFileName}>
                                        ✓ {entry.certificateFileName || 'PDF'}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setModalPdf({
                                          data: entry.certificateData,
                                          name: entry.certificateFileName,
                                          title: `${entry.name} Certificate`
                                        })}
                                        className="p-1 rounded bg-[#194e42] text-white hover:bg-[#143d34] cursor-pointer"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => updateIndividualField(idx, 'certificateData', null)}
                                        className="p-1 rounded text-[#d32f2f] hover:bg-[#ffebee] cursor-pointer"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <input
                                      type="file"
                                      accept="application/pdf,.pdf"
                                      onChange={e => handleIndividualPdf(idx, e.target.files?.[0])}
                                      className="text-[11px] file:mr-1 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[10px] file:font-bold file:bg-[#e2eee4] file:text-[#194e42] hover:file:bg-[#d5e7d8] cursor-pointer"
                                    />
                                  )}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeIndividualResult(idx)}
                                    className="p-1 rounded text-[#697c7c] hover:text-[#d32f2f] hover:bg-[#ffebee] cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Overall Sport Certificate PDF (Optional Fallback) ── */}
                <div className="p-4 rounded-xl border-2 border-dashed border-[#2f6d5a] bg-[#f8faf7] space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-extrabold text-sm text-[#173235] flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#194e42]" />
                        Overall Sport Award Certificate PDF (Optional Fallback)
                      </h4>
                      <p className="text-xs text-[#697c7c] mt-0.5">
                        Acts as a universal fallback certificate for any player or participant without an individual certificate PDF.
                      </p>
                    </div>

                    {overallCertificate?.data ? (
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-[#e2eee4] text-[#194e42] font-bold text-xs border border-[#2f6d5a]">
                          ✓ {overallCertificate.name} ({Math.round(overallCertificate.size / 1024)} KB)
                        </span>
                        <button
                          type="button"
                          onClick={() => setModalPdf({
                            data: overallCertificate.data,
                            name: overallCertificate.name,
                            title: `${sportConfig.sportName} Overall Certificate`
                          })}
                          className="px-3 py-1 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] cursor-pointer"
                        >
                          Preview
                        </button>
                        <button
                          type="button"
                          onClick={() => setOverallCertificate(null)}
                          className="px-3 py-1 rounded-lg border border-[#e57373] text-[#d32f2f] hover:bg-[#ffebee] text-xs font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        onChange={e => readPdfFile(e.target.files?.[0], cert => setOverallCertificate(cert), onMessage)}
                        className="text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-[#194e42] file:text-white hover:file:bg-[#143d34] cursor-pointer"
                      />
                    )}
                  </div>
                </div>

                {/* ── Action Buttons ── */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-[#d8ded5]">
                  <div className="text-xs text-[#526668]">
                    {entries.length > 0 ? (
                      <span><strong>{entries.length}</strong> result record(s) ready in this sport draft.</span>
                    ) : (
                      <span>Add at least one result entry to enable publishing.</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || !entries.length}
                      onClick={handleSaveDraft}
                      className="px-5 py-2.5 rounded-xl border border-[#2f6d5a] text-[#194e42] hover:bg-[#e2eee4] text-xs font-bold disabled:opacity-50 transition cursor-pointer"
                    >
                      {busy ? 'Saving…' : 'SAVE DRAFT'}
                    </button>

                    <button
                      type="button"
                      disabled={busy || !entries.length}
                      onClick={handleFreeze}
                      className="px-6 py-2.5 rounded-xl bg-[#e07050] hover:bg-[#c95d3e] text-white text-xs font-black tracking-wide disabled:opacity-50 transition cursor-pointer shadow-md flex items-center gap-2"
                    >
                      <Shield className="w-4 h-4" />
                      {busy ? 'Publishing…' : 'PUBLISH & FREEZE SPORT'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </article>
      )}

      {/* ── CERTIFICATE PDF PREVIEW MODAL ── */}
      {modalPdf && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 space-y-4 shadow-2xl border border-[#2f6d5a]">
            <div className="flex justify-between items-center border-b pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#194e42]" />
                <h3 className="font-extrabold text-base text-[#173235]">{modalPdf.title || 'Official Certificate'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setModalPdf(null)}
                className="p-1 rounded-lg text-[#697c7c] hover:text-[#173235] hover:bg-[#f4f8f5] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <iframe
                src={modalPdf.data}
                title={modalPdf.title}
                className="w-full h-[460px] rounded-xl border border-[#d8ded5]"
              />

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <span className="text-xs text-[#697c7c]">File: <b>{modalPdf.name}</b></span>
                <div className="flex gap-2">
                  <a
                    href={modalPdf.data}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 rounded-lg bg-[#194e42] text-white text-xs font-bold hover:bg-[#143d34] transition inline-flex items-center gap-1.5"
                  >
                    Open in New Tab
                  </a>
                  <a
                    href={modalPdf.data}
                    download={modalPdf.name || 'Certificate.pdf'}
                    className="px-4 py-2 rounded-lg border border-[#2f6d5a] text-[#194e42] hover:bg-[#e2eee4] text-xs font-bold transition inline-flex items-center gap-1.5"
                  >
                    Download PDF
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
