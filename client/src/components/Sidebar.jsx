import { NavLink } from 'react-router-dom';
import { Building2, ChevronRight, HeartHandshake, LayoutGrid, LogOut, Menu, Trophy, UserRound, UsersRound, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import api from '../services/api';

const links = [
  { to: '/parent', role: 'parent', label: 'Pathway finder', icon: LayoutGrid, caption: 'Parent workspace' },
  { to: '/athlete', role: 'athlete', label: 'Athlete profile', icon: UserRound, caption: 'Training & growth' },
  { to: '/athlete/recommendations', role: 'athlete', label: 'Recommendations', icon: Trophy, caption: 'Verified academy matches' },
  { to: '/coach', role: 'coach', label: 'Coach desk', icon: UsersRound, caption: 'Athlete relationships' },
  { to: '/sponsor', role: 'sponsor', label: 'Impact studio', icon: HeartHandshake, caption: 'Support & reports' },
  { to: '/academy', role: 'academy', label: 'Academy hub', icon: Building2, caption: 'Listing & verification' },
];

function Navigation({ close }) {
  const { user, logout } = useAuth();
  const { notifCount, totalUnreadMessages } = useSocket();
  const activeRole = user?.role;
  const [unreadRecCount, setUnreadRecCount] = useState(0);

  useEffect(() => {
    if (activeRole !== 'athlete') return;
    let isMounted = true;
    const fetchUnread = async () => {
      try {
        const { data } = await api.get('/recommendations/unread-count');
        if (isMounted && typeof data?.count === 'number') {
          setUnreadRecCount(data.count);
        }
      } catch (err) {
        // Silently ignore network errors
      }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [activeRole]);

  const visibleLinks = links.filter(({ role: linkRole }) => activeRole ? activeRole === linkRole : linkRole === 'parent');

  return (
    <nav className="navigation" aria-label="Primary navigation">
      <p className="nav-label">Your Workspace</p>
      {visibleLinks.map(({ to, label, icon: Icon, caption, role: linkRole }) => {
        let badgeCount = 0;
        if (linkRole === 'coach') {
          badgeCount = notifCount + totalUnreadMessages;
        } else if (to === '/athlete/recommendations') {
          badgeCount = unreadRecCount;
        } else if (linkRole === 'athlete') {
          badgeCount = totalUnreadMessages;
        }

        const isPulse = to === '/athlete/recommendations' && unreadRecCount > 0;

        return (
          <NavLink
            key={to}
            to={to}
            onClick={close}
            className={({ isActive }) => ['nav-link', isActive && 'is-active', isPulse && 'animate-pulse ring-1 ring-[#e07050]/40'].filter(Boolean).join(' ')}
          >
            <Icon size={17} strokeWidth={1.8} className={isPulse ? 'text-[#e07050]' : ''} />
            <span>
              <b className={isPulse ? 'text-[#e07050]' : ''}>{label}</b>
              <small>{caption}</small>
            </span>
            {/* Notification badge */}
            {badgeCount > 0 && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: '#e07050',
                color: '#fff',
                fontSize: 10,
                fontWeight: 800,
                padding: '0 5px',
                lineHeight: 1,
                boxShadow: isPulse ? '0 0 10px rgba(224, 112, 80, 0.7)' : 'none'
              }}>
                {badgeCount > 99 ? '99+' : badgeCount}
              </span>
            )}
            <ChevronRight className="nav-chevron" size={15} />
          </NavLink>
        );
      })}

      {/* LOGOUT */}
      <button
        onClick={() => { if (close) close(); logout(); }}
        type="button"
        className="nav-link"
        style={{
          marginTop: '6px',
          background: '#fff3f0',
          color: '#e07050',
          borderColor: '#efcbc3',
          fontWeight: '700',
          cursor: 'pointer'
        }}
      >
        <LogOut size={17} strokeWidth={2} />
        <span>
          <b style={{ color: '#e07050' }}>Sign Out</b>
          <small style={{ color: '#a44e3d' }}>Exit active session</small>
        </span>
      </button>
    </nav>
  );
}

function SideContent({ close }) {
  const { user } = useAuth();

  return (
    <div className="side-content">
      <div className="brand-lockup flex items-center justify-between">
        <div className="login-logo" style={{ fontSize: '16px', color: '#173235', fontWeight: 800 }}>
          <span>ta</span> trackathlete
        </div>
        {close && (
          <button
            className="p-1.5 rounded-lg bg-white/70 hover:bg-white text-[#526668] hover:text-[#173235] border border-[#d8ded5] transition cursor-pointer"
            onClick={close}
            aria-label="Close navigation"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <Navigation close={close} />
      <div className="sidebar-bottom" style={{ background: '#fcfcf8', borderColor: '#d8ded5' }}>
        <div className="build-tag" style={{ color: '#194e42' }}><i /> SIH 2026 · LIVE PROTOTYPE</div>
        <p style={{ margin: '4px 0 0', color: '#526668', fontSize: '11px' }}>
          Logged in as <strong style={{ color: '#173235' }}>{user?.name || user?.email || 'User'}</strong> <span style={{ color: '#cc694e', textTransform: 'capitalize' }}>({user?.role})</span>
        </p>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="sidebar"><SideContent /></aside>
      <div className="mobile-bar">
        <div className="login-logo" style={{ fontSize: '16px', color: '#fff', fontWeight: 800 }}>
          <span>ta</span> trackathlete
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button className="menu-trigger" aria-label="Open navigation">
              <Menu size={20} />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="mobile-sheet" showCloseButton={false}>
            <SideContent close={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
