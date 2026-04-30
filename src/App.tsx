/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, ReactNode } from 'react';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';
import { UserProfile, UserRole } from './types';
import { LogIn, LogOut, LayoutDashboard, Briefcase, FileText, CheckCircle, Bell, User as UserIcon, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Pages - define them locally or imported if complex
import StudentPortal from './pages/StudentPortal';
import CoordinatorPortal from './pages/CoordinatorPortal';
import SupervisorPortal from './pages/SupervisorPortal';

import { DashboardSkeleton, SidebarSkeleton } from './components/Skeleton';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'applications' | 'logbook' | 'reports' | 'notifications' | 'partners' | 'chat'>('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            setUser({ id: firebaseUser.uid, ...userDoc.data() } as UserProfile);
          } else {
            setNewUserId(firebaseUser.uid);
            setNewUserEmail(firebaseUser.email || '');
            setNewUserName(firebaseUser.displayName || 'Anonymous');
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, 'users');
        }
      } else {
        setUser(null);
        setNewUserId(null);
      }
      // Add artificial delay for skeleton demo
      setTimeout(() => setLoading(false), 800);
    });

    return () => unsubscribe();
  }, []);

  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [studentCredits, setStudentCredits] = useState('');
  const [studentGPA, setStudentGPA] = useState('');

  const registerUser = async () => {
    if (!newUserId || !selectedRole) return;
    
    // Validate student data if role is student
    if (selectedRole === 'student') {
      const credits = parseFloat(studentCredits);
      const gpa = parseFloat(studentGPA);
      
      if (isNaN(credits) || isNaN(gpa) || credits < 0 || gpa < 0 || gpa > 4.0) {
        alert('Please enter valid credit hours (≥0) and GPA (0.0-4.0)');
        return;
      }
    }
    
    try {
      const newUser: UserProfile = {
        id: newUserId,
        email: newUserEmail,
        name: newUserName,
        role: selectedRole
      };
      await setDoc(doc(db, 'users', newUserId), newUser);
      
      if (selectedRole === 'student') {
        const credits = parseFloat(studentCredits);
        const required = 120;
        const gpa = parseFloat(studentGPA);
        const eligible = credits >= 80 && gpa >= 2.0;

        await addDoc(collection(db, 'students'), {
          userId: newUserId,
          programme: 'Bachelor of Computer Science',
          creditsEarned: credits,
          requiredCredits: required,
          gpa: gpa,
          isEligible: eligible
        });

        // Send initial notification
        await addDoc(collection(db, 'notifications'), {
          userId: newUserId,
          title: eligible ? 'Internship Eligible' : 'Ineligible for Internship',
          message: eligible 
            ? 'Based on your credits and GPA, you are eligible to apply for placements.' 
            : 'You have not met the requirements. Please contact the coordinator.',
          read: false,
          type: eligible ? 'update' : 'warning',
          createdAt: new Date().toISOString()
        });
      }

      setUser(newUser);
      setNewUserId(null);
      setSelectedRole(null);
      setStudentCredits('');
      setStudentGPA('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'users');
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex font-sans">
        <SidebarSkeleton />
        <main className="flex-1 p-8">
          <DashboardSkeleton />
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#E4E3E0] p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]"
        >
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tighter text-[#141414] italic serif">InternTrack.</h1>
            <p className="text-sm text-gray-500 uppercase tracking-widest mt-2 mono">Industrial Training Management</p>
          </div>
          
          {newUserId ? (
            <div className="space-y-4">
              {!selectedRole ? (
                <>
                  <p className="text-sm font-bold mono uppercase tracking-widest text-[#141414]/60">Select Your Role</p>
                  <div className="grid gap-3">
                    {(['student', 'coordinator', 'supervisor'] as UserRole[]).map(role => (
                      <motion.button 
                        key={role}
                        onClick={() => setSelectedRole(role)}
                        whileHover={{ scale: 1.02, x: 4 }}
                        whileTap={{ scale: 0.98 }}
                        className="w-full text-left p-4 border border-[#141414] hover:bg-[#141414] hover:text-white transition-colors duration-200 group cursor-pointer shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] hover:shadow-[2px_2px_0px_0px_rgba(20,20,20,1)]"
                      >
                        <p className="font-bold uppercase tracking-widest text-xs group-hover:text-white">{role}</p>
                        <p className="text-[10px] mt-1 opacity-60 group-hover:opacity-80">
                          {role === 'student' ? 'Access internships and submit logbooks' : 
                           role === 'coordinator' ? 'Manage placements and monitor compliance' : 
                           'Evaluate intern performance'}
                        </p>
                      </motion.button>
                    ))}
                  </div>
                </>
              ) : selectedRole === 'student' ? (
                <>
                  <button 
                    onClick={() => setSelectedRole(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
                  >
                    ← Back to role selection
                  </button>
                  <p className="text-sm font-bold mono uppercase tracking-widest text-[#141414]/60">Student Information</p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                        Credit Hours Earned
                      </label>
                      <input 
                        type="number"
                        value={studentCredits}
                        onChange={(e) => setStudentCredits(e.target.value)}
                        placeholder="e.g. 90"
                        min="0"
                        step="1"
                        className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                      />
                      <p className="text-[9px] text-gray-400 mt-1 mono">Minimum 80 credits required for internship</p>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                        Current CGPA
                      </label>
                      <input 
                        type="number"
                        value={studentGPA}
                        onChange={(e) => setStudentGPA(e.target.value)}
                        placeholder="e.g. 3.50"
                        min="0"
                        max="4.0"
                        step="0.01"
                        className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                      />
                      <p className="text-[9px] text-gray-400 mt-1 mono">Scale: 0.00 - 4.00 (Minimum 2.00 required)</p>
                    </div>
                    <motion.button 
                      onClick={registerUser}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!studentCredits || !studentGPA}
                      className="w-full bg-[#141414] text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)]"
                    >
                      Complete Registration
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setSelectedRole(null)}
                    className="text-xs text-gray-500 hover:text-gray-700 mb-2 flex items-center gap-1"
                  >
                    ← Back to role selection
                  </button>
                  <p className="text-sm font-bold mono uppercase tracking-widest text-[#141414]/60">
                    Confirm Registration as {selectedRole}
                  </p>
                  <motion.button 
                    onClick={registerUser}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full bg-[#141414] text-white py-4 font-bold uppercase tracking-widest hover:bg-gray-800 transition-all shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)]"
                  >
                    Complete Registration
                  </motion.button>
                </>
              )}
            </div>
          ) : (
            <motion.button 
              onClick={handleLogin}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center justify-center gap-3 bg-[#141414] text-[#E4E3E0] py-4 px-6 font-bold hover:bg-gray-800 transition-colors shadow-[4px_4px_0px_0px_rgba(20,20,20,0.3)] hover:shadow-[2px_2px_0px_0px_rgba(20,20,20,0.3)]"
            >
              <LogIn size={20} />
              Continue with Google
            </motion.button>
          )}
          
          <p className="mt-6 text-xs text-center text-gray-400 mono">
            Secure enterprise access. Restricted to authorized personnel.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E4E3E0] flex font-sans selection:bg-[#141414] selection:text-[#E4E3E0]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[#141414] flex flex-col fixed h-full bg-white z-10">
        <div className="p-6 border-bottom border-[#141414]">
          <h1 className="text-2xl font-bold italic serif">InternTrack.</h1>
          <div className="flex items-center gap-2 mt-4 px-2 py-1 bg-gray-100 rounded text-[10px] uppercase tracking-tighter font-bold mono">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {user.role} active
          </div>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          <NavItem 
            icon={<LayoutDashboard size={18} />} 
            label="Dashboard" 
            active={activeTab === 'dashboard'} 
            onClick={() => setActiveTab('dashboard')} 
          />
          {user.role === 'student' && (
            <>
              <NavItem 
                icon={<Briefcase size={18} />} 
                label="Placements" 
                active={activeTab === 'applications'} 
                onClick={() => setActiveTab('applications')} 
              />
              <NavItem 
                icon={<FileText size={18} />} 
                label="Logbook" 
                active={activeTab === 'logbook'} 
                onClick={() => setActiveTab('logbook')} 
              />
              <NavItem 
                icon={<CheckCircle size={18} />} 
                label="Reports" 
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')} 
              />
              <NavItem 
                icon={<MessageSquare size={18} />} 
                label="Chat" 
                active={activeTab === 'chat'} 
                onClick={() => setActiveTab('chat')} 
              />
            </>
          )}
          {user.role === 'coordinator' && (
            <>
              <NavItem 
                icon={<Briefcase size={18} />} 
                label="Partners" 
                active={activeTab === 'partners'} 
                onClick={() => setActiveTab('partners')} 
              />
              <NavItem 
                icon={<FileText size={18} />} 
                label="Reports" 
                active={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')} 
              />
            </>
          )}
          <NavItem 
            icon={<Bell size={18} />} 
            label="Notifications" 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')} 
          />
        </nav>

        <div className="p-4 border-t border-[#141414]">
          <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 mb-4">
            <div className="w-8 h-8 bg-[#141414] text-white rounded flex items-center justify-center font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="text-xs font-bold truncate">{user.name}</p>
              <p className="text-[10px] text-gray-500 truncate mono uppercase">{user.email}</p>
            </div>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest py-2 border border-[#141414] hover:bg-[#141414] hover:text-white transition-all"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab + user.role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {user.role === 'student' && (
              <StudentPortal tab={activeTab} user={user} />
            )}
            {user.role === 'coordinator' && (
              <CoordinatorPortal tab={activeTab} user={user} />
            )}
            {user.role === 'supervisor' && (
              <SupervisorPortal tab={activeTab} user={user} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
        active 
          ? 'bg-[#141414] text-white shadow-[4px_4px_0px_0px_rgba(31,31,31,0.2)]' 
          : 'text-gray-600 hover:bg-gray-50 border border-transparent hover:border-gray-200'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

