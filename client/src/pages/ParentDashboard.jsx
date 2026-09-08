import { useEffect, useState } from 'react';
import api from '../services/api';
import SportRankCard from '../components/SportRankCard';
import FederationListsSection from '../components/FederationListsSection';
import OrganizedEventsSection from '../components/OrganizedEventsSection';
import { useAuth } from '../context/AuthContext';

export default function ParentDashboard() {
  const { user } = useAuth();
  const [cities, setCities] = useState([]);
  const [sports, setSports] = useState([]);
  const [myOrganizedData, setMyOrganizedData] = useState(null);

  const [city, setCity] = useState(user?.city || 'Vijayawada');
  const [sport, setSport] = useState(user?.childSport || user?.sport || 'Taekwondo');
  const [radiusKm, setRadiusKm] = useState('');

  const [searchResult, setSearchResult] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const [recommendations, setRecommendations] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState('');

  useEffect(() => {
    api.get('/parent/reference').then((res) => {
      setCities(res.data.cities || []);
      setSports(res.data.sports || []);
      
      const initialCity = user?.city && res.data.cities?.includes(user.city) ? user.city : res.data.cities?.[0] || 'Vijayawada';
      const initialSport = user?.childSport && res.data.sports?.includes(user.childSport) ? user.childSport : res.data.sports?.[0] || 'Taekwondo';
      
      setCity(initialCity);
      setSport(initialSport);

      // Trigger dynamic search automatically on page load
      setSearchLoading(true);
      api.get('/parent/search', { params: { city: initialCity, sport: initialSport } })
        .then(searchRes => setSearchResult(searchRes.data))
        .catch(err => setSearchError(err.response?.data?.error || 'Search failed'))
        .finally(() => setSearchLoading(false));

      api.get('/organizer-events/my-organized-events')
        .then(res => setMyOrganizedData(res.data))
        .catch(() => setMyOrganizedData(null));
    });
  }, [user]);

  async function handleSearch(e) {
    if (e) e.preventDefault();
    setSearchLoading(true);
    setSearchError('');
    setRecommendations(null);
    try {
      const res = await api.get('/parent/search', {
        params: { city, sport, radiusKm: radiusKm || undefined }
      });
      setSearchResult(res.data);
    } catch (err) {
      setSearchError(err.response?.data?.error || 'Search failed');
    } finally {
      setSearchLoading(false);
    }
  }

  async function handleNotSatisfied() {
    setRecLoading(true);
    setRecError('');
    try {
      const res = await api.get('/parent/recommend', {
        params: { city, radiusKm: radiusKm || undefined }
      });
      setRecommendations(res.data);
    } catch (err) {
      setRecError(err.response?.data?.error || 'Recommendation failed');
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-md">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="eyebrow" style={{ color: '#e9a68e', margin: 0 }}>PARENTS & FAMILIES · PATHWAY FINDER</p>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">
              ID: {user?.parentId || user?.trackAthleteId || 'PAR-N/A'}
            </span>
          </div>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            Welcome back, <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>{user?.name || 'Parent'}</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1">
            Find sports academies &amp; SAI centres near you, or discover better opportunities for your child.
          </p>
        </div>
        {user?.childName && (
          <div className="bg-[#e2eee4] border border-[#2f6d5a] rounded-xl px-4 py-2.5 text-xs text-[#194e42]">
            <span className="text-[#cc694e] font-extrabold block text-[10px] tracking-wider uppercase">Child Profile</span>
            <span className="font-bold text-[#173235]">{user.childName}</span>
            <span className="text-[#526668]"> (Age: {user.childAge || 'N/A'}, Target Sport: {user.childSport || 'Taekwondo'})</span>
          </div>
        )}
      </div>

      {/* SEARCH FORM */}
      <form onSubmit={handleSearch} className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs font-bold text-[#526668] mb-1.5 uppercase tracking-wider">City</label>
            <select
              className="w-full h-11 bg-[#fffefa] border border-[#d2dad2] rounded-lg px-3 text-sm text-[#1d2c31] focus:border-[#4a8a70] outline-none"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            >
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#526668] mb-1.5 uppercase tracking-wider">Sport</label>
            <select
              className="w-full h-11 bg-[#fffefa] border border-[#d2dad2] rounded-lg px-3 text-sm text-[#1d2c31] focus:border-[#4a8a70] outline-none"
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              {sports.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#526668] mb-1.5 uppercase tracking-wider">Radius (km)</label>
            <input
              type="number"
              className="w-full h-11 bg-[#fffefa] border border-[#d2dad2] rounded-lg px-3 text-sm text-[#1d2c31] placeholder-[#80908e] focus:border-[#4a8a70] outline-none"
              placeholder="e.g. 50 (Leave blank for nationwide)"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={searchLoading}
          className="login-submit w-full md:w-auto px-6 h-11 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs tracking-wider uppercase transition-all shadow-md cursor-pointer"
        >
          {searchLoading ? 'Searching MongoDB...' : 'Search Academies & SAI Centres'}
        </button>
      </form>

      {searchError && <div className="text-coral text-sm mb-4">{searchError}</div>}

      {/* SEARCH RESULTS */}
      {searchResult && (
        <div className="mb-8 bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-6 shadow-sm space-y-6">
          <div>
            <h2 className="text-xl font-normal text-[#173235]" style={{ fontFamily: 'Georgia, serif' }}>
              Results for <span className="font-bold text-[#e07050]">{searchResult.sport}</span> near <span className="font-bold text-[#194e42]">{searchResult.city}</span>
              {searchResult.radiusKm ? ` (within ${searchResult.radiusKm} km)` : ' (nationwide, nearest first)'}
            </h2>
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-[#526668] mb-3 uppercase tracking-wider">
              SAI / Government Centres ({searchResult.saiCentres.length}
              {searchResult.radiusKm ? ` of ${searchResult.allSaiCentresCount} nationwide` : ''})
            </h3>
            {searchResult.saiCentres.length === 0 && (
              <div className="text-xs text-[#697c7c] p-4 bg-[#f4f8f3] rounded-xl border border-[#d8ded5]">No SAI centres found in this range.</div>
            )}
            {searchResult.saiCentres.map((c) => (
              <div key={c._id || c.centreName} className="bg-white border border-[#d8ded5] rounded-xl p-4 mb-2.5 flex justify-between items-center shadow-xs">
                <div>
                  <div className="font-bold text-sm text-[#173235]">{c.centreName || c.name}</div>
                  <div className="text-xs text-[#526668] mt-0.5">
                    {c.scheme} · {c.region || c.city}, {c.state} · Entry: <span className="font-semibold text-[#194e42]">{c.entryPathway}</span>
                  </div>
                </div>
                <div className="text-xs font-extrabold text-[#194e42] bg-[#e2eee4] px-3 py-1 rounded-full border border-[#2f6d5a]/30">{c.distanceKm} km</div>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-xs font-extrabold text-[#526668] mb-3 uppercase tracking-wider">
              Private Academies ({searchResult.academies.length})
            </h3>
            {searchResult.academies.length === 0 && (
              <div className="text-xs text-[#697c7c] p-4 bg-[#f4f8f3] rounded-xl border border-[#d8ded5]">
                No verified academies found in this range.
                {searchResult.city !== 'Vijayawada' &&
                  ' (Private academy data is currently seeded for Vijayawada only.)'}
              </div>
            )}
            {searchResult.academies.map((a) => (
              <div key={a._id || a.name} className="bg-white border border-[#d8ded5] rounded-xl p-4 mb-2.5 flex justify-between items-center shadow-xs">
                <div>
                  <div className="font-bold text-sm text-[#173235]">{a.name}</div>
                  <div className="text-xs text-[#526668] mt-0.5">{a.city}, {a.state}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${a.verified ? 'bg-[#e2eee4] text-[#194e42] border-[#2f6d5a]' : 'bg-[#fff3f0] text-[#a44e3d] border-[#efcbc3]'}`}>
                    {a.verified ? 'Verified' : 'Unverified'}
                  </span>
                  <span className="text-xs font-extrabold text-[#194e42] bg-[#e2eee4] px-3 py-1 rounded-full border border-[#2f6d5a]/30">{a.distanceKm} km</span>
                </div>
              </div>
            ))}
          </div>

          {/* NOT SATISFIED BUTTON */}
          <div className="mt-6 text-center border-t border-[#d8ded5] pt-6">
            <p className="text-xs font-medium text-[#526668] mb-3">
              Not satisfied with this? Want better opportunities and open to changing sport?
            </p>
            <button
              onClick={handleNotSatisfied}
              className="login-submit inline-flex items-center justify-center gap-2 px-6 h-11 rounded-xl bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider shadow-md transition-all cursor-pointer"
              disabled={recLoading}
            >
              {recLoading ? 'Calculating Recommendations...' : '🔍 Explore Better Sports For This Location'}
            </button>
          </div>
        </div>
      )}

      {recError && <div className="text-[#a44e3d] text-xs font-bold p-3 bg-[#fff3f0] border border-[#efcbc3] rounded-xl mb-4">{recError}</div>}

      {/* RECOMMENDATIONS */}
      {recommendations && (
        <div className="space-y-4">
          <div className="bg-[#fcfcf8] border border-[#d8ded5] rounded-2xl p-5 shadow-sm">
            <h2 className="text-xl font-normal text-[#173235]" style={{ fontFamily: 'Georgia, serif' }}>
              Best Sports for <span className="font-bold text-[#194e42]">{recommendations.city}</span> ({recommendations.radiusKm} km radius)
            </h2>
            <p className="text-xs text-[#526668] mt-1">
              Ranked using the 11-rule TrackAthlete recommendation engine — every rule is transparent and explainable. Tap any sport below to inspect the full point breakdown.
            </p>
          </div>
          {recommendations.recommendations.map((r, i) => (
            <SportRankCard key={r.sport} rank={i + 1} result={r} />
          ))}
        </div>
      )}

      {myOrganizedData?.hasLinkedOrganizer && (
        <OrganizedEventsSection initialData={myOrganizedData} />
      )}

      <FederationListsSection />
    </div>
  );
}
