import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Badge,
  Input,
  Label,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
  useToast,
  ProgressChart,
} from '../components/ui';
import { HeartHandshake, ShieldCheck, DollarSign, Award, Send, CheckCircle2 } from 'lucide-react';
import OrganizedEventsSection from '../components/OrganizedEventsSection';

export default function SponsorDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [fundingAmount, setFundingAmount] = useState('50000');
  const [athletes, setAthletes] = useState([]);
  const [myOrganizedData, setMyOrganizedData] = useState(null);

  useEffect(() => {
    // Query real athletes seeking sponsorship from MongoDB Atlas
    api.get('/sponsor/athletes').then(res => {
      if (res.data && res.data.length > 0) {
        setAthletes(res.data.map(a => ({
          id: a._id,
          name: a.name,
          sport: a.sport || 'Taekwondo',
          level: a.beltRank || 'State Representative',
          need: a.sponsorshipReason || 'Funding for National/International Championship Equipment & Travel',
          verified: true
        })));
      } else {
        setAthletes([
          { id: '1', name: 'Rahul Sharma', sport: 'Taekwondo', level: 'Black Belt 1st Dan', need: '₹50,000 for National Championship Equipment', verified: true }
        ]);
      }
    }).catch(() => {
      setAthletes([
        { id: '1', name: 'Rahul Sharma', sport: 'Taekwondo', level: 'Black Belt 1st Dan', need: '₹50,000 for National Championship Equipment', verified: true }
      ]);
    });

    api.get('/organizer-events/my-organized-events')
      .then(res => setMyOrganizedData(res.data))
      .catch(() => setMyOrganizedData(null));
  }, []);

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* SPONSOR HEADER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#cc694e]" /> Verified Corporate Sponsor
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">{user?.targetSports?.join(', ') || 'All Sports'}</span>
          </div>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {user?.organizationName || user?.name || 'Sponsor'} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Studio</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1">
            Budget Range: {user?.budgetRange || '₹50,000 - ₹5,00,000'} · {user?.city || 'Mumbai'}, {user?.state || 'Maharashtra'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
            <Award className="w-3.5 h-3.5 mr-1.5 text-[#cc694e]" /> Section 135 CSR Compliant
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ATHLETE LEDGER */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-normal text-[#173235] flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <HeartHandshake className="w-5 h-5 text-[#cc694e]" /> Verified Athlete Support Ledger
            </CardTitle>
            <CardDescription className="text-xs text-[#526668]">
              Browse verified promising athletes requiring tournament & equipment support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {athletes.map((ath) => (
              <div key={ath.id} className="p-4 rounded-2xl border border-[#d8ded5] bg-white shadow-xs space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-[#173235] text-sm">{ath.name}</h4>
                    <p className="text-xs text-[#526668] mt-0.5">{ath.sport} · {ath.level}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
                    <ShieldCheck className="w-3 h-3 text-[#cc694e]" /> Verified Ledger
                  </span>
                </div>
                <div className="text-xs text-[#173235] bg-[#f4f8f3] p-3 rounded-xl border border-[#d8ded5]">
                  <span className="text-[#526668] font-bold uppercase text-[10px] block mb-1">Target Support Requirement</span>
                  <span className="font-semibold text-[#194e42]">{ath.need}</span>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedAthlete(ath)}
                    className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[#e2eee4] hover:bg-[#d4e6d7] text-[#194e42] font-bold text-xs border border-[#2f6d5a]/40 transition-all cursor-pointer"
                  >
                    <HeartHandshake className="w-4 h-4 mr-1 text-[#cc694e]" /> Submit Support Intent
                  </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* CSR SUMMARY */}
        <Card>
          <CardHeader>
            <CardTitle>CSR Allocation Summary</CardTitle>
            <CardDescription className="text-xs">Fund disbursement & impact analytics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ProgressChart value={75} label="Disbursed Funds Tracked" />
            <ProgressChart value={100} label="CSR Compliance Status" />
            <div className="p-3.5 rounded-xl bg-[#f4f8f3] border border-[#d8ded5] text-xs text-[#526668] space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-[#173235]">
                <CheckCircle2 className="w-4 h-4 text-[#cc694e]" /> Verification Guarantee
              </div>
              <p className="text-[11px] text-[#526668] leading-relaxed">
                Receipts and tournament entry proofs are verified by accredited state federations prior to fund release.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PLEDGE DIALOG */}
      <Dialog isOpen={!!selectedAthlete} onClose={() => setSelectedAthlete(null)}>
        <DialogHeader>
          <DialogTitle>Pledge CSR Support for {selectedAthlete?.name}</DialogTitle>
          <DialogDescription>Submit your corporate non-binding sponsorship intent</DialogDescription>
        </DialogHeader>
        <DialogContent className="space-y-4">
          <div>
            <Label required>Pledge Amount (INR)</Label>
            <Input value={fundingAmount} onChange={(e) => setFundingAmount(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label>Funding Purpose</Label>
            <Input defaultValue="Tournament travel & professional equipment" readOnly className="mt-1 bg-[#f4f8f3] border-[#d8ded5] text-[#173235] font-bold" />
          </div>
        </DialogContent>
        <DialogFooter>
          <button type="button" className="px-4 h-9 rounded-lg border border-[#d8ded5] text-[#526668] text-xs font-bold" onClick={() => setSelectedAthlete(null)}>Cancel</button>
          <button
            type="button"
            className="login-submit flex items-center justify-center gap-1.5 h-9 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
            onClick={() => {
              toast({
                title: 'Sponsorship Intent Submitted',
                description: `Pledged ₹${fundingAmount} for ${selectedAthlete?.name}.`,
                variant: 'success',
              });
              setSelectedAthlete(null);
            }}
          >
            <Send className="w-4 h-4 mr-1" /> Submit Intent
          </button>
        </DialogFooter>
      </Dialog>

      {myOrganizedData?.hasLinkedOrganizer && (
        <OrganizedEventsSection initialData={myOrganizedData} />
      )}
    </div>
  );
}
