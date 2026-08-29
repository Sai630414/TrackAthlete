import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
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
  Textarea,
  useToast,
} from '../components/ui';
import { Building2, ShieldCheck, MapPin, Award, CheckCircle2, Save, Check } from 'lucide-react';

export default function AcademyDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [academy, setAcademy] = useState({
    name: user?.academyName || user?.name || 'Victory Sports Academy',
    sport: user?.sportsOffered?.join(', ') || 'Taekwondo',
    city: user?.city || 'Vijayawada',
    state: user?.state || 'Andhra Pradesh',
    contactPhone: user?.contactPhone || '+91 98765 43210',
    address: user?.address || 'Benz Circle, Vijayawada',
    courts: 'Indoor Training Center & Gear Equipment',
    feeRange: '₹2,500 - ₹4,500 / month',
    verified: true,
  });

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      {/* ACADEMY HEADER */}
      <div className="bg-gradient-to-r from-[#173d3c] via-[#123130] to-[#0c292c] border border-[#2f6d5a] p-6 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#cc694e]" /> Verified Coaching Facility
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono text-[#c5d3ce] border border-white/20">Academy Hub</span>
          </div>
          <h1 className="text-3xl font-normal text-white" style={{ fontFamily: 'Georgia, serif' }}>
            {academy.name} <em style={{ color: '#b9d9bf', fontStyle: 'italic' }}>Hub</em>
          </h1>
          <p className="text-xs text-[#c5d3ce] mt-1 flex items-center gap-2">
            <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-[#e9a68e]" /> {academy.city}, {academy.state}</span>
            <span>·</span>
            <span>Disciplines Offered: {academy.sport}</span>
          </p>
        </div>

        <div className="flex gap-3">
          <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-bold bg-[#e2eee4] text-[#194e42] border border-[#2f6d5a]">
            <Award className="w-3.5 h-3.5 mr-1.5 text-[#cc694e]" /> SAI Partner Facility
          </span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-normal text-[#173235] flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
            <Building2 className="w-5 h-5 text-[#cc694e]" /> Academy Self-Listing & Facility Details
          </CardTitle>
          <CardDescription className="text-xs text-[#526668]">
            Update your academy information visible to searching athletes and parents in nationwide recommendations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label required>Academy Name</Label>
              <Input
                value={academy.name}
                onChange={(e) => setAcademy({ ...academy, name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label required>Primary Sport Offered</Label>
              <Input
                value={academy.sport}
                onChange={(e) => setAcademy({ ...academy, sport: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Facility Infrastructure</Label>
              <Input
                value={academy.courts}
                onChange={(e) => setAcademy({ ...academy, courts: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Fee Structure</Label>
              <Input
                value={academy.feeRange}
                onChange={(e) => setAcademy({ ...academy, feeRange: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label>Coaching & Sports Science Amenities</Label>
            <Textarea
              defaultValue="Physiotherapy room, NIS certified head coach, video motion analysis, gym & endurance track."
              className="mt-1 min-h-[100px]"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              className="login-submit flex items-center justify-center gap-1.5 h-10 px-5 rounded-lg bg-[#e07050] hover:bg-[#c85c40] text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer"
              onClick={() => toast({ title: 'Academy Listing Updated', variant: 'success' })}
            >
              <Check className="w-4 h-4 mr-1" /> Save Listing Changes
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
