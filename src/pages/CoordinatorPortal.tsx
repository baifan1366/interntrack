import { useState, useEffect, ReactNode } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, updateDoc, doc, addDoc, serverTimestamp, getDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { UserProfile, Placement, StudentData, Company, LogbookEntry, Notification, Evaluation, Report } from '../types';
import { Users, Building2, CheckCircle, XCircle, AlertTriangle, Send, Activity, Clock, FileWarning, Search, Filter, PieChart as PieChartIcon } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { DashboardSkeleton } from '../components/Skeleton';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function CoordinatorPortal({ tab, user }: { tab: string, user: UserProfile }) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [logbooks, setLogbooks] = useState<LogbookEntry[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyContact, setNewCompanyContact] = useState('');
  const [newCompanyEmail, setNewCompanyEmail] = useState('');
  const [newCompanyIndustry, setNewCompanyIndustry] = useState('');
  const [newCompanyLocation, setNewCompanyLocation] = useState('');
  const [newCompanyDescription, setNewCompanyDescription] = useState('');
  const [selectedPlacementForApproval, setSelectedPlacementForApproval] = useState<string | null>(null);
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [plSnap, stSnap, usSnap, coSnap, loSnap, evSnap, reSnap] = await Promise.all([
          getDocs(collection(db, 'placements')),
          getDocs(collection(db, 'students')),
          getDocs(collection(db, 'users')),
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'logbooks')),
          getDocs(collection(db, 'evaluations')),
          getDocs(collection(db, 'reports'))
        ]);

        setPlacements(plSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Placement));
        setStudents(stSnap.docs.map(d => ({ id: d.id, ...d.data() }) as StudentData));
        setUsers(usSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserProfile));
        setCompanies(coSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Company));
        setLogbooks(loSnap.docs.map(d => ({ id: d.id, ...d.data() }) as LogbookEntry));
        setEvaluations(evSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Evaluation));
        setReports(reSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Report));
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'coordinator data');
      }
      setTimeout(() => setLoading(false), 800);
    };

    fetchData();
  }, []);

  const handleUpdatePlacementStatus = async (placementId: string, status: Placement['status'], supervisorId?: string) => {
    try {
      const updateData: any = { 
        status,
        offerDate: status === 'approved' ? new Date().toISOString() : null
      };
      
      if (status === 'approved' && supervisorId) {
        updateData.supervisorId = supervisorId;
      }
      
      await updateDoc(doc(db, 'placements', placementId), updateData);
      setPlacements(prev => prev.map(p => p.id === placementId ? { ...p, ...updateData } : p));
      
      const p = placements.find(x => x.id === placementId);
      const student = students.find(s => s.id === p?.studentId);
      if (student) {
        await addDoc(collection(db, 'notifications'), {
          userId: student.userId,
          title: status === 'approved' ? 'Internship Offer' : 'Application Result',
          message: status === 'approved' 
            ? 'A company has accepted your application. Please review and accept the offer in your dashboard.' 
            : 'Your application has been processed.',
          read: false,
          type: status === 'approved' ? 'alert' : 'update',
          createdAt: new Date().toISOString()
        });
      }
      
      // Reset selection
      setSelectedPlacementForApproval(null);
      setSelectedSupervisorId('');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'placements');
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: Report['status'], feedback?: string) => {
    try {
      await updateDoc(doc(db, 'reports', reportId), { status, feedback: feedback || null });
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status, feedback: feedback || null } : r));
      
      const report = reports.find(r => r.id === reportId);
      const student = students.find(s => s.id === report?.studentId);
      if (student) {
        await addDoc(collection(db, 'notifications'), {
          userId: student.userId,
          title: `Report ${status.toUpperCase()}`,
          message: `Your ${report?.type} report has been ${status}.${feedback ? ` Feedback: ${feedback}` : ''}`,
          read: false,
          type: status === 'approved' ? 'update' : 'warning',
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'reports');
    }
  };

  const handleAddCompany = async () => {
    if (!newCompanyName || !newCompanyContact || !newCompanyEmail) {
      alert('Please fill in all required fields (Name, Contact Person, Email)');
      return;
    }

    try {
      const newCompany = {
        name: newCompanyName,
        contactPerson: newCompanyContact,
        email: newCompanyEmail,
        industry: newCompanyIndustry || 'Technology',
        location: newCompanyLocation || 'Malaysia',
        description: newCompanyDescription || '',
        approved: true,
        createdAt: new Date().toISOString()
      };

      const docRef = await addDoc(collection(db, 'companies'), newCompany);
      setCompanies(prev => [...prev, { id: docRef.id, ...newCompany }]);
      
      // Reset form
      setNewCompanyName('');
      setNewCompanyContact('');
      setNewCompanyEmail('');
      setNewCompanyIndustry('');
      setNewCompanyLocation('');
      setNewCompanyDescription('');
      setIsAddingCompany(false);
      
      alert('Company added successfully!');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'companies');
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    if (!confirm(`Are you sure you want to remove ${company?.name}?`)) return;

    try {
      await updateDoc(doc(db, 'companies', companyId), { approved: false });
      setCompanies(prev => prev.filter(c => c.id !== companyId));
      alert('Company removed from system.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'companies');
    }
  };

  const getRiskStatus = (studentId: string) => {
    const studentPlacement = placements.find(p => p.studentId === studentId && p.status === 'ongoing');
    if (!studentPlacement) return null;

    const studentLogs = logbooks.filter(l => l.studentId === studentId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (studentLogs.length === 0) {
      const daysSinceStart = differenceInDays(new Date(), new Date(studentPlacement.startDate!));
      if (daysSinceStart > 7) return { level: 'high', reason: 'Zero submissions after 1 week' };
      return null;
    }

    const lastLogDate = new Date(studentLogs[0].createdAt);
    const gap = differenceInDays(new Date(), lastLogDate);

    if (gap > 14) return { level: 'high', reason: 'Stopped reporting since 2 weeks' };
    if (gap > 7) return { level: 'medium', reason: 'Late weekly submission' };
    
    const evaluation = evaluations.find(e => e.studentId === studentId);
    if (!evaluation && studentPlacement.status === 'completed') return { level: 'medium', reason: 'Missing industry evaluation' };

    return null;
  };

  if (loading) return <DashboardSkeleton />;

  const handleInitializeSystem = async () => {
    try {
      const coSnap = await getDocs(collection(db, 'companies'));
      if (coSnap.empty) {
        const demoCompanies = [
          { name: 'Apple Inc.', contactPerson: 'Recruitment Team', email: 'interns@apple.com', approved: true },
          { name: 'Google Malaysia', contactPerson: 'Campus Relations', email: 'my-campus@google.com', approved: true },
          { name: 'Tesla Energy', contactPerson: 'HR Dept', email: 'future@tesla.com', approved: true },
          { name: 'Local Startup X', contactPerson: 'Founder', email: 'hello@startupx.com', approved: false },
        ];
        for (const c of demoCompanies) {
          await addDoc(collection(db, 'companies'), c);
        }
        alert("System initialized with demo partners.");
        window.location.reload();
      } else {
        alert("System data already exists.");
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'system-init');
    }
  };

  if (tab === 'dashboard') {
    const atRisk = students.map(s => ({ ...s, risk: getRiskStatus(s.id) })).filter(s => s.risk !== null);
    const pendingPlacements = placements.filter(p => p.status === 'pending');
    const supervisors = users.filter(u => u.role === 'supervisor');

    const statusData = [
      { name: 'Ongoing', value: placements.filter(p => p.status === 'ongoing').length, color: '#141414' },
      { name: 'Awaiting', value: placements.filter(p => p.status === 'approved').length, color: '#4B5563' },
      { name: 'Pending', value: placements.filter(p => p.status === 'pending').length, color: '#9CA3AF' },
      { name: 'Completed', value: placements.filter(p => p.status === 'completed').length, color: '#E5E7EB' },
    ].filter(d => d.value > 0);

    const riskData = [
      { name: 'High Risk', value: atRisk.filter(s => s.risk?.level === 'high').length, fill: '#ef4444' },
      { name: 'Medium Risk', value: atRisk.filter(s => s.risk?.level === 'medium').length, fill: '#f97316' },
      { name: 'Compliant', value: students.length - atRisk.length, fill: '#141414' },
    ];

    return (
      <div className="space-y-8">
        <header className="flex justify-between items-start">
          <div>
            <h2 className="text-4xl font-bold tracking-tight text-[#141414]">Oversight Dashboard.</h2>
            <p className="text-gray-500 mt-2 italic serif">Academic Year 2026/27 · Session II</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleInitializeSystem}
              className="px-4 py-2 bg-white border border-[#141414] text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all"
            >
              Init System
            </button>
            <button className="px-4 py-2 bg-white border border-[#141414] text-[10px] font-black uppercase tracking-widest hover:bg-gray-50 transition-all flex items-center gap-2">
              <FileWarning size={14} /> Export Audit
            </button>
          </div>
        </header>

        <div className="grid grid-cols-4 gap-4">
          <StatCard icon={<Users size={20} />} label="Total Cohort" value={students.length.toString()} />
          <StatCard icon={<Activity size={20} />} label="Active Training" value={placements.filter(p => p.status === 'ongoing').length.toString()} />
          <StatCard icon={<Clock size={20} />} label="Awaiting Offer" value={placements.filter(p => p.status === 'approved').length.toString()} />
          <StatCard icon={<AlertTriangle size={20} className="text-red-500" />} label="Intervention" value={atRisk.length.toString()} highlight />
        </div>

        <div className="grid grid-cols-3 gap-8">
           {/* Analytics Box */}
           <div className="col-span-1 space-y-6">
              <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                 <h3 className="font-bold text-[10px] uppercase tracking-widest mono mb-6 flex items-center gap-2">
                    <PieChartIcon size={12} /> Placement Mix
                 </h3>
                 <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                       <PieChart>
                          <Pie
                            data={statusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={60}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {statusData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ fontSize: '10px', fontStyle: 'italic', border: '1px solid #141414' }}
                          />
                       </PieChart>
                    </ResponsiveContainer>
                 </div>
                 <div className="grid grid-cols-2 gap-2 mt-4">
                    {statusData.map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                         <div className="w-2 h-2" style={{ backgroundColor: d.color }} />
                         <span className="text-[10px] mono uppercase text-gray-500">{d.name} ({d.value})</span>
                      </div>
                    ))}
                 </div>
              </div>

              <div className="bg-[#141414] text-white p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.1)]">
                 <h3 className="font-bold text-[10px] uppercase tracking-widest mono mb-6 text-gray-400">Compliance Ratio</h3>
                 <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={riskData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                          <XAxis dataKey="name" stroke="#666" fontSize={8} tickLine={false} axisLine={false} />
                          <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }} contentStyle={{ background: '#141414', border: '1px solid #333', fontSize: '10px' }} />
                          <Bar dataKey="value" radius={[2, 2, 0, 0]} />
                       </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
           </div>

          {/* Main Feed: Applications */}
          <div className="col-span-2 space-y-6">
            <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="p-4 border-b border-[#141414] bg-gray-50">
                <h3 className="font-bold text-xs uppercase tracking-widest mono">Placement Requests</h3>
              </div>
              <div className="divide-y divide-gray-100 max-h-[500px] overflow-auto">
                {pendingPlacements.map(p => {
                  const s = students.find(x => x.id === p.studentId);
                  const u = users.find(x => x.id === s?.userId);
                  const c = companies.find(x => x.id === p.companyId);
                  const isSelectingSupervisor = selectedPlacementForApproval === p.id;
                  
                  return (
                    <div key={p.id} className="p-4 bg-white hover:bg-gray-50/50 transition-colors">
                      <div className="flex justify-between items-start">
                        <div className="flex gap-4 items-center">
                          <div className="w-10 h-10 bg-gray-100 flex items-center justify-center font-bold text-gray-400">
                            {u?.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{u?.name}</p>
                            <p className="text-[10px] text-gray-400 mono uppercase">{c?.name}</p>
                            {s && (
                              <p className="text-[9px] text-gray-500 mono mt-1">
                                Credits: {s.creditsEarned} | GPA: {s.gpa.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        {!isSelectingSupervisor ? (
                          <div className="flex gap-3">
                             <button 
                               onClick={() => setSelectedPlacementForApproval(p.id)}
                               className="text-[10px] font-black uppercase text-green-600 underline tracking-tighter hover:text-green-800"
                              >
                               Approve
                             </button>
                             <button 
                               onClick={() => handleUpdatePlacementStatus(p.id, 'rejected')}
                               className="text-[10px] font-black uppercase text-red-600 underline tracking-tighter hover:text-red-800"
                             >
                               Refuse
                             </button>
                          </div>
                        ) : null}
                      </div>
                      
                      {isSelectingSupervisor && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-green-900 mono mb-3">
                            Assign Academic Supervisor
                          </p>
                          <div className="flex gap-3">
                            <select 
                              value={selectedSupervisorId}
                              onChange={(e) => setSelectedSupervisorId(e.target.value)}
                              className="flex-1 bg-white border border-[#141414] p-2 text-xs outline-none"
                            >
                              <option value="">-- Select Supervisor --</option>
                              {supervisors.map(sup => (
                                <option key={sup.id} value={sup.id}>
                                  {sup.name} ({sup.email})
                                </option>
                              ))}
                            </select>
                            <button 
                              onClick={() => {
                                if (!selectedSupervisorId) {
                                  alert('Please select a supervisor');
                                  return;
                                }
                                handleUpdatePlacementStatus(p.id, 'approved', selectedSupervisorId);
                              }}
                              disabled={!selectedSupervisorId}
                              className="bg-green-600 text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                              Confirm
                            </button>
                            <button 
                              onClick={() => {
                                setSelectedPlacementForApproval(null);
                                setSelectedSupervisorId('');
                              }}
                              className="border border-gray-300 text-gray-700 px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
                            >
                              Cancel
                            </button>
                          </div>
                          {supervisors.length === 0 && (
                            <p className="text-[9px] text-orange-600 mt-2 mono">
                              ⚠️ No supervisors registered in the system. Please add supervisors first.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {pendingPlacements.length === 0 && <p className="p-12 text-center text-gray-400 italic serif">No pending applications in the queue.</p>}
              </div>
            </section>

            <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <div className="p-4 border-b border-[#141414] bg-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-widest mono">Live Tracking Overview</h3>
                <span className="text-[10px] mono text-gray-400">N={students.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                   <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="p-4 font-bold uppercase mono text-[10px]">Student</th>
                        <th className="p-4 font-bold uppercase mono text-[10px]">Programme</th>
                        <th className="p-4 font-bold uppercase mono text-[10px]">Placement</th>
                        <th className="p-4 font-bold uppercase mono text-[10px]">Supervisor</th>
                        <th className="p-4 font-bold uppercase mono text-[10px]">Status</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-gray-100">
                      {students.map(s => {
                        const u = users.find(x => x.id === s.userId);
                        const p = placements.find(x => x.studentId === s.id);
                        const supervisor = p?.supervisorId ? users.find(x => x.id === p.supervisorId) : null;
                        return (
                          <tr key={s.id} className="hover:bg-gray-50/50">
                            <td className="p-4 font-bold">{u?.name}</td>
                            <td className="p-4 text-gray-500 uppercase tracking-tighter">{s.programme}</td>
                            <td className="p-4">{p ? companies.find(c => c.id === p.companyId)?.name : 'N/A'}</td>
                            <td className="p-4 text-gray-600">
                              {supervisor ? supervisor.name : (p?.status === 'approved' || p?.status === 'ongoing' ? '⚠️ Unassigned' : '-')}
                            </td>
                            <td className="p-4">
                               <span className={`text-[10px] font-black uppercase mono px-2 py-0.5 rounded-full ${
                                 p?.status === 'ongoing' ? 'bg-green-100 text-green-700' : 
                                 p?.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'
                               }`}>
                                 {p?.status || 'idle'}
                               </span>
                            </td>
                          </tr>
                        );
                      })}
                   </tbody>
                </table>
              </div>
            </section>
          </div>

          {/* Right Sidebar: Risk Alerts */}
          <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
             <div className="p-4 border-b border-[#141414] bg-red-50">
                <h3 className="font-bold text-xs uppercase tracking-widest mono text-red-900 flex items-center gap-2">
                  <AlertTriangle size={14} /> At-Risk Detection
                </h3>
             </div>
             <div className="p-4 space-y-4">
                {atRisk.map(s => {
                  const userObj = users.find(u => u.id === s.userId);
                  return (
                    <div key={s.id} className={`p-4 border ${s.risk?.level === 'high' ? 'border-red-200 bg-red-50/50' : 'border-orange-200 bg-orange-50/50'}`}>
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-sm font-bold">{userObj?.name}</p>
                        <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${s.risk?.level === 'high' ? 'bg-red-600 text-white' : 'bg-orange-600 text-white'}`}>
                          {s.risk?.level}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-600 italic mb-3">{s.risk?.reason}</p>
                      <div className="flex gap-2">
                         <button 
                           onClick={async () => {
                             try {
                               await addDoc(collection(db, 'notifications'), {
                                 userId: userObj?.id,
                                 title: 'Urgent: Logbook Submission Missing',
                                 message: 'Our systems show a gap in your weekly logbook reporting. Please update your status immediately.',
                                 read: false,
                                 type: 'alert',
                                 createdAt: new Date().toISOString(),
                                 deadline: new Date(Date.now() + 86400000).toISOString()
                               });
                               alert(`Alert sent to ${userObj?.name}`);
                             } catch (e) {
                               console.error(e);
                             }
                           }}
                           className="flex-1 bg-white border border-[#141414] py-1.5 text-[8px] font-black uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all text-center"
                         >
                           Send Alert
                         </button>
                         <button className="flex-1 bg-white border border-[#141414] py-1.5 text-[8px] font-black uppercase tracking-widest hover:bg-[#141414] hover:text-white transition-all">Review Profile</button>
                      </div>
                    </div>
                  );
                })}
                {atRisk.length === 0 && (
                  <div className="py-20 text-center opacity-30">
                    <CheckCircle size={32} className="mx-auto mb-2" />
                    <p className="text-[10px] mono font-bold uppercase">System Compliant</p>
                  </div>
                )}
             </div>
          </section>
        </div>
      </div>
    );
  }

  if (tab === 'partners') {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-3xl font-bold italic serif">Industry Partners.</h2>
          <p className="text-gray-500 text-sm mt-1 mono uppercase tracking-widest">Manage authorized training organizations</p>
        </header>

        {/* Add Company Form */}
        {isAddingCompany && (
          <div className="bg-white border-2 border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg">Add New Company</h3>
              <button 
                onClick={() => setIsAddingCompany(false)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Cancel
              </button>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Company Name *
                </label>
                <input 
                  type="text"
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g. Google Malaysia"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Industry
                </label>
                <input 
                  type="text"
                  value={newCompanyIndustry}
                  onChange={(e) => setNewCompanyIndustry(e.target.value)}
                  placeholder="e.g. Technology, Finance, Healthcare"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Contact Person *
                </label>
                <input 
                  type="text"
                  value={newCompanyContact}
                  onChange={(e) => setNewCompanyContact(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Email *
                </label>
                <input 
                  type="email"
                  value={newCompanyEmail}
                  onChange={(e) => setNewCompanyEmail(e.target.value)}
                  placeholder="e.g. hr@company.com"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Location
                </label>
                <input 
                  type="text"
                  value={newCompanyLocation}
                  onChange={(e) => setNewCompanyLocation(e.target.value)}
                  placeholder="e.g. Kuala Lumpur, Malaysia"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Description
                </label>
                <input 
                  type="text"
                  value={newCompanyDescription}
                  onChange={(e) => setNewCompanyDescription(e.target.value)}
                  placeholder="Brief description of the company"
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                />
              </div>
            </div>

            <button 
              onClick={handleAddCompany}
              className="mt-6 w-full bg-[#141414] text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all"
            >
              Add Company to System
            </button>
          </div>
        )}

        <div className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
           <div className="p-4 border-b border-[#141414] bg-gray-50 flex justify-between items-center">
              <div className="relative w-72">
                 <Search size={14} className="absolute left-3 top-3 text-gray-400" />
                 <input 
                   type="text" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   placeholder="Search partners..."
                   className="w-full bg-white border border-gray-200 p-2 pl-9 text-xs outline-none focus:border-[#141414]"
                 />
              </div>
              <button 
                onClick={() => setIsAddingCompany(true)}
                className="bg-[#141414] text-white px-4 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2"
              >
                 <Building2 size={14} /> Add Organization
              </button>
           </div>
           <div className="divide-y divide-gray-100">
              {companies.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(company => (
                <div key={company.id} className="p-4 flex justify-between items-center hover:bg-gray-50">
                   <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-bold text-sm">{company.name}</h4>
                        {company.approved && (
                          <span className="text-[8px] font-black uppercase bg-green-100 text-green-700 px-2 py-0.5 mono">Active</span>
                        )}
                      </div>
                      <div className="flex gap-6 text-[10px] text-gray-500">
                         <span className="mono">👤 {company.contactPerson}</span>
                         <span className="mono">✉️ {company.email}</span>
                         {(company as any).industry && <span className="mono">🏢 {(company as any).industry}</span>}
                         {(company as any).location && <span className="mono">📍 {(company as any).location}</span>}
                      </div>
                   </div>
                   <div className="flex items-center gap-4">
                      <button 
                        onClick={() => handleDeleteCompany(company.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors"
                      >
                         <XCircle size={18} />
                      </button>
                   </div>
                </div>
              ))}
              {companies.length === 0 && (
                <div className="py-20 text-center text-gray-300">
                  <Building2 size={40} className="mx-auto mb-2 opacity-20" />
                  <p className="italic serif">No companies in the system yet.</p>
                  <button 
                    onClick={() => setIsAddingCompany(true)}
                    className="mt-4 text-xs font-bold underline text-blue-600"
                  >
                    Add your first company
                  </button>
                </div>
              )}
           </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-blue-800">
            <p className="font-bold mb-1">Partner Management Guidelines</p>
            <p>Only approved companies will be visible to students in the placement application system. Ensure all contact information is accurate before adding a company.</p>
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'reports') {
    const pendingReports = reports.filter(r => r.status === 'pending');
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-3xl font-bold italic serif">Academic Reporting.</h2>
          <p className="text-gray-500 text-sm mt-1 mono uppercase tracking-widest">Review and approve assessment documents</p>
        </header>

        <div className="grid grid-cols-3 gap-8">
           <div className="col-span-1 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-widest mono text-gray-400">Review Queue</h3>
              {pendingReports.map(report => {
                const s = students.find(x => x.id === report.studentId);
                const u = users.find(x => x.id === s?.userId);
                return (
                  <div key={report.id} className="bg-white border border-[#141414] p-4 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
                     <div className="flex justify-between items-start mb-2">
                        <span className="text-[8px] font-black uppercase bg-[#141414] text-white px-2 py-0.5 mono">{report.type}</span>
                        <span className="text-[10px] text-gray-400 mono">{format(new Date(report.submittedAt), 'MMM d')}</span>
                     </div>
                     <h4 className="font-bold text-sm mb-1">{report.title}</h4>
                     <p className="text-[10px] text-gray-500 mb-4">{u?.name}</p>
                     
                     <div className="flex gap-2">
                        <button 
                          onClick={() => handleUpdateReportStatus(report.id, 'approved')}
                          className="flex-1 bg-green-50 text-green-700 border border-green-200 py-1.5 text-[8px] font-black uppercase tracking-widest hover:bg-green-100 transition-all"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => {
                            const revisionFeedback = prompt("Enter feedback for revision:");
                            if (revisionFeedback) handleUpdateReportStatus(report.id, 'revision', revisionFeedback);
                          }}
                          className="flex-1 bg-orange-50 text-orange-700 border border-orange-200 py-1.5 text-[8px] font-black uppercase tracking-widest hover:bg-orange-100 transition-all"
                        >
                          Revision
                        </button>
                     </div>
                     <a href={report.fileUrl} target="_blank" rel="noreferrer" className="block text-center mt-3 text-[8px] font-bold underline uppercase tracking-widest text-[#141414]">View Document</a>
                  </div>
                );
              })}
              {pendingReports.length === 0 && <p className="p-8 text-center text-gray-400 italic text-xs">All clear! No reports pending review.</p>}
           </div>

           <div className="col-span-2 space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-widest mono text-gray-400">Submission History</h3>
              <div className="bg-white border border-gray-200">
                 {reports.filter(r => r.status !== 'pending').map(report => {
                    const s = students.find(x => x.id === report.studentId);
                    const u = users.find(x => x.id === s?.userId);
                    return (
                      <div key={report.id} className="p-4 border-b border-gray-100 flex justify-between items-center">
                         <div>
                            <p className="font-bold text-sm">{report.title}</p>
                            <p className="text-[10px] text-gray-400 mono uppercase">{u?.name} · {report.type}</p>
                         </div>
                         <div className="text-right">
                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${report.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                               {report.status}
                            </span>
                            <p className="text-[8px] text-gray-400 mt-1 mono">{format(new Date(report.submittedAt), 'PP')}</p>
                         </div>
                      </div>
                    );
                 })}
              </div>
           </div>
        </div>
      </div>
    );
  }

  return <div className="p-20 text-center text-gray-400">Section available in full version.</div>;
}

function StatCard({ icon, label, value, highlight }: { icon: ReactNode, label: string, value: string, highlight?: boolean }) {
  return (
    <div className={`p-6 border border-[#141414] bg-white ${highlight ? 'shadow-[4px_4px_0px_0px_rgba(239,68,68,1)]' : 'shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]'}`}>
      <div className="text-gray-400 mb-4">{icon}</div>
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mono">{label}</p>
      <p className="text-3xl font-black mt-1 tracking-tighter">{value}</p>
    </div>
  );
}
