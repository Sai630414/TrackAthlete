import { useEffect, useState } from 'react';
import { Landmark, Mail, MapPin, Phone, Globe, RefreshCw } from 'lucide-react';
import api from '../services/api';

function Contact({ title, person }) {
  if (!person || !Object.values(person).some(Boolean)) return null;
  return <p className="text-[11px] text-[#526668]"><strong>{title}:</strong> {[person.name, person.address, person.phone, person.email, person.website].filter(Boolean).join(' · ')}</p>;
}

export default function FederationListsSection() {
  const [federations, setFederations] = useState([]);
  const [associations, setAssociations] = useState([]);
  const [activeList, setActiveList] = useState('federations');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/federations'), api.get('/associations')])
      .then(([federationResponse, associationResponse]) => {
        setFederations(federationResponse.data || []);
        setAssociations(associationResponse.data || []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-5 md:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e2eee4] pb-4">
        <div className="flex items-center gap-2">
          <Landmark className="w-5 h-5 text-[#194e42]" />
          <div>
            <h2 className="font-extrabold text-[#173235] text-base" style={{ fontFamily: 'Georgia, serif' }}>Federation Lists</h2>
            <p className="text-xs text-[#526668]">Official organizations and state associations from the MongoDB directory.</p>
          </div>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-[#e2eee4] self-start">
          <button type="button" onClick={() => setActiveList('federations')} className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${activeList === 'federations' ? 'bg-[#173235] text-white' : 'text-[#194e42]'}`}>
            Official Federations ({federations.length})
          </button>
          <button type="button" onClick={() => setActiveList('associations')} className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer ${activeList === 'associations' ? 'bg-[#173235] text-white' : 'text-[#194e42]'}`}>
            State Associations ({associations.length})
          </button>
        </div>
      </div>

      {loading ? <div className="py-8 text-center text-xs text-[#697c7c]"><RefreshCw className="inline w-4 h-4 animate-spin mr-2" />Loading MongoDB directory…</div> : activeList === 'federations' ? (
        federations.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{federations.map((item) => (
          <article key={item.federationId} className="rounded-xl border border-[#d8ded5] bg-white p-4 space-y-1.5">
            <div className="flex justify-between gap-3"><div><h3 className="font-extrabold text-sm text-[#173235]">{item.name}</h3><p className="text-[11px] font-mono text-[#194e42]">{item.federationId}</p></div><span className="h-fit text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42]">{item.status}</span></div>
            <p className="text-xs text-[#526668]"><strong>{item.sport}</strong> · {item.state} {item.abbreviation ? `· ${item.abbreviation}` : ''}</p>
            <p className="text-[11px] text-[#526668]">Recognition: {item.recognitionStatus} {item.recognitionYear ? `(${item.recognitionYear})` : ''}</p>
            <p className="text-[11px] text-[#526668]">Account: {item.accountActivated ? 'Activated' : 'Not activated'} · Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-IN') : '—'}</p>
            {item.officialEmail && <p className="text-[11px] text-[#526668] flex gap-1"><Mail size={12} />{item.officialEmail}</p>}
            {item.officialPhone && <p className="text-[11px] text-[#526668] flex gap-1"><Phone size={12} />{item.officialPhone}</p>}
            {item.website && <a className="text-[11px] text-[#e07050] font-bold flex gap-1" href={item.website} target="_blank" rel="noreferrer"><Globe size={12} />Website</a>}
            {item.sourceDocument && <p className="text-[11px] text-[#526668]">Source: {item.sourceDocument}</p>}
          </article>
        ))}</div> : <Empty label="official federations" />
      ) : associations.length ? <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{associations.map((item) => (
        <article key={item.associationId} className="rounded-xl border border-[#d8ded5] bg-white p-4 space-y-1.5">
          <div className="flex justify-between gap-3"><div><h3 className="font-extrabold text-sm text-[#173235]">{item.associationName}</h3><p className="text-[11px] font-mono text-[#194e42]">{item.associationId}</p></div><span className="h-fit text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#e2eee4] text-[#194e42]">{item.status}</span></div>
          <p className="text-xs text-[#526668]"><strong>{item.sport}</strong> · {item.state}</p>
          {item.nationalFederationName && <p className="text-[11px] text-[#526668]">Affiliated Federation: {item.nationalFederationName} {item.nationalFederationAbbreviation && `(${item.nationalFederationAbbreviation})`}</p>}
          {item.registrationOrSerialNo && <p className="text-[11px] text-[#526668]">Registration: {item.registrationOrSerialNo}</p>}
          {item.address && <p className="text-[11px] text-[#526668] flex gap-1"><MapPin size={12} />{item.address}</p>}
          {item.email && <p className="text-[11px] text-[#526668] flex gap-1"><Mail size={12} />{item.email}</p>}
          {item.phone && <p className="text-[11px] text-[#526668] flex gap-1"><Phone size={12} />{item.phone}</p>}
          {item.website && <a className="text-[11px] text-[#e07050] font-bold flex gap-1" href={item.website} target="_blank" rel="noreferrer"><Globe size={12} />Website</a>}
          <Contact title="President" person={item.president} /><Contact title="Secretary" person={item.secretary} /><Contact title="Treasurer" person={item.treasurer} />
          <p className="text-[10px] text-[#697c7c]">Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-IN') : '—'}</p>
        </article>
      ))}</div> : <Empty label="state associations" />}
    </section>
  );
}

function Empty({ label }) {
  return <div className="py-8 text-center text-xs text-[#697c7c] border border-dashed border-[#d8ded5] rounded-xl">No {label} are currently stored in MongoDB.</div>;
}
