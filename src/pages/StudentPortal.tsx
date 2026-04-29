import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { UserProfile, Placement, LogbookEntry, Company, StudentData, Notification, Report } from '../types';
import { Briefcase, Calendar, CheckSquare, Plus, Send, AlertCircle, FileUp, History, Bell, Check, X, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { DashboardSkeleton } from '../components/Skeleton';

export default function StudentPortal({ tab, user }: { tab: string, user: UserProfile }) {
  const [studentData, setStudentData] = useState<StudentData | null>(null);
  const [placement, setPlacement] = useState<Placement | null>(null);
  const [logbooks, setLogbooks] = useState<LogbookEntry[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [logbookContent, setLogbookContent] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [reportTitle, setReportTitle] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [reportType, setReportType] = useState<'midterm' | 'final'>('midterm');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');

  useEffect(() => {
    let unsubNotifications: () => void;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const studentQuery = query(collection(db, 'students'), where('userId', '==', user.id));
        const studentSnap = await getDocs(studentQuery);
        
        if (!studentSnap.empty) {
          const sData = { id: studentSnap.docs[0].id, ...studentSnap.docs[0].data() } as StudentData;
          setStudentData(sData);
          const sId = studentSnap.docs[0].id;

          // Placement listener
          const placementQuery = query(collection(db, 'placements'), where('studentId', '==', sId));
          const placementSnap = await getDocs(placementQuery);
          if (!placementSnap.empty) {
            setPlacement({ id: placementSnap.docs[0].id, ...placementSnap.docs[0].data() } as Placement);
          }

          // Logbooks listener
          const logbookQuery = query(collection(db, 'logbooks'), where('studentId', '==', sId), orderBy('createdAt', 'desc'));
          const logbookSnap = await getDocs(logbookQuery);
          setLogbooks(logbookSnap.docs.map(d => ({ id: d.id, ...d.data() }) as LogbookEntry));

          // Reports listener
          const reportQuery = query(collection(db, 'reports'), where('studentId', '==', sId));
          const reportSnap = await getDocs(reportQuery);
          setReports(reportSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Report));
        }

        const companiesSnap = await getDocs(collection(db, 'companies'));
        setCompanies(companiesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Company));

        // Real-time notifications
        const q = query(collection(db, 'notifications'), where('userId', '==', user.id), orderBy('createdAt', 'desc'));
        unsubNotifications = onSnapshot(q, (snapshot) => {
          setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as Notification));
        });

      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'student data');
      }
      setTimeout(() => setLoading(false), 600);
    };

    fetchData();
    return () => unsubNotifications?.();
  }, [user.id]);

  const handleApply = async () => {
    if (!studentData?.isEligible) return;
    try {
      await addDoc(collection(db, 'placements'), {
        studentId: studentData.id,
        companyId: selectedCompanyId,
        status: 'pending',
        createdAt: new Date().toISOString()
      });
      alert("Application sent to Coordinator.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'placements');
    }
  };

  const handlePlacementAction = async (action: 'ongoing' | 'rejected') => {
    if (!placement) return;
    try {
      await updateDoc(doc(db, 'placements', placement.id), { 
        status: action,
        startDate: action === 'ongoing' ? new Date().toISOString() : null
      });
      setPlacement(prev => prev ? { ...prev, status: action } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'placements');
    }
  };

  const handleSubmitLogbook = async () => {
    if (!studentData || !logbookContent) return;
    try {
      await addDoc(collection(db, 'logbooks'), {
        studentId: studentData.id,
        weekNumber: logbooks.length + 1,
        content: logbookContent,
        fileUrl: fileUrl || null,
        createdAt: new Date().toISOString(),
        editCount: 0,
        isAutoSubmitted: false
      });
      setLogbookContent('');
      setFileUrl('');
      alert("Logbook entry secured.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'logbooks');
    }
  };

  const handleSubmitReport = async () => {
    if (!studentData || !reportUrl || !reportTitle) {
      alert("Please fill in all report details.");
      return;
    }
    try {
      await addDoc(collection(db, 'reports'), {
        studentId: studentData.id,
        type: reportType,
        title: reportTitle,
        fileUrl: reportUrl,
        status: 'pending',
        submittedAt: new Date().toISOString()
      });
      setReportTitle('');
      setReportUrl('');
      alert("Report submitted for review.");
      // Refresh reports
      const reportQuery = query(collection(db, 'reports'), where('studentId', '==', studentData.id));
      const reportSnap = await getDocs(reportQuery);
      setReports(reportSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Report));
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
    }
  };

  if (loading) return <DashboardSkeleton />;

  if (tab === 'dashboard') {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-4xl font-bold tracking-tight text-[#141414]">Student Dashboard.</h2>
          <p className="text-gray-500 mt-2">Welcome, {user.name}. Track your training progress here.</p>
        </header>

        <div className="grid grid-cols-3 gap-6">
          <StatusCard 
            title="Syllabus Progress" 
            value={studentData?.isEligible ? "GO FOR INTERN" : "PREREQ MISSING"} 
            status={studentData?.isEligible ? "success" : "error"}
          />
          <StatusCard 
            title="Active Placement" 
            value={placement?.status.toUpperCase() || "NO OFFER"} 
            status={placement?.status === 'ongoing' ? 'success' : placement?.status === 'pending' ? 'warning' : 'neutral'}
          />
          <StatusCard 
            title="Logbook Status" 
            value={`${logbooks.length} WEEKS`} 
            status="info"
          />
        </div>

        <div className="grid grid-cols-2 gap-8">
          {/* Eligibility Specs */}
          <div className="bg-white border border-[#141414] p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
             <h3 className="font-bold flex items-center gap-2 mb-4">
              <CheckSquare size={18} /> Eligibility Parameters
             </h3>
             <div className="space-y-4">
               <ProgressBar label="Credits Earned" current={studentData?.creditsEarned || 0} target={studentData?.requiredCredits || 120} />
               <ProgressBar label="Current GPA" current={studentData?.gpa || 0} target={4.0} isGPA />
               <div className="pt-2 flex items-center gap-2">
                 <div className={`w-3 h-3 rounded-full ${studentData?.isEligible ? 'bg-green-500' : 'bg-red-500'}`} />
                 <span className="text-xs font-bold mono uppercase">
                  {studentData?.isEligible ? 'Technically Qualified' : 'Qualification Pending'}
                 </span>
               </div>
             </div>
          </div>

          {/* Action Center - Offer Management */}
          {placement && placement.status === 'approved' && (
            <div className="bg-[#141414] text-white p-6 shadow-[4px_4px_0px_0px_rgba(20,20,20,0.2)]">
               <h3 className="font-bold text-lg mb-2">Internship Offer Received</h3>
               <p className="text-xs text-gray-400 mb-6">Agreement from {companies.find(c => c.id === placement.companyId)?.name}. Please confirm to start training.</p>
               <div className="flex gap-4">
                  <button 
                    onClick={() => handlePlacementAction('ongoing')}
                    className="flex-1 bg-white text-[#141414] py-3 font-black text-xs uppercase tracking-widest hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                  >
                    <Check size={16} /> Accept
                  </button>
                  <button 
                    onClick={() => handlePlacementAction('rejected')}
                    className="flex-1 border border-white/30 text-white py-3 font-black text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                  >
                    <X size={16} /> Decline
                  </button>
               </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (tab === 'logbook') {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-3xl font-bold italic serif">Professional Logbook.</h2>
        </header>

        <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
           <div className="flex justify-between items-end mb-4">
             <h4 className="text-sm font-bold">Week {logbooks.length + 1} Continuous Journaling</h4>
             <span className="text-[10px] text-gray-400 mono">SERVER TIME RECORDED</span>
           </div>
           <textarea 
            value={logbookContent}
            onChange={(e) => setLogbookContent(e.target.value)}
            placeholder="Document daily tasks, technical hurdles, and breakthroughs..."
            className="w-full h-40 bg-gray-50 border border-[#141414] p-4 text-sm focus:ring-0 outline-none resize-none font-sans leading-relaxed"
           />
           <div className="mt-4 flex items-center gap-4">
              <div className="flex-1 relative">
                <input 
                  type="text" 
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="Link artifacts (GitHub, Figma, Docs)..."
                  className="w-full bg-gray-50 border border-[#141414] p-2 pl-8 text-xs outline-none"
                />
                <FileUp size={14} className="absolute left-2 top-2.5 text-gray-400" />
              </div>
              <button 
                onClick={handleSubmitLogbook}
                disabled={!placement || placement.status !== 'ongoing'}
                className="bg-[#141414] text-white px-8 py-3 font-black text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 transition-all"
              >
                Seal Entry
              </button>
           </div>
           {!placement || placement.status !== 'ongoing' && (
             <p className="text-[10px] text-red-500 mt-2 mono font-bold">LOGGING IS ONLY PERMITTED DURING ACTIVE INTERNSHIP</p>
           )}
        </div>

        <div className="space-y-4">
           {logbooks.map(entry => (
             <div key={entry.id} className="bg-white border border-gray-200 p-6 flex gap-6">
                <div className="text-center">
                   <div className="text-[10px] font-bold text-gray-400 mono mb-1">WEEK</div>
                   <div className="text-2xl font-black">{entry.weekNumber}</div>
                </div>
                <div className="flex-1">
                   <div className="flex justify-between mb-2">
                      <span className="text-[10px] text-gray-400 mono">{format(new Date(entry.createdAt), 'MMM d, yyyy · HH:mm')}</span>
                      {entry.editCount > 0 && <span className="text-[10px] text-orange-500 font-bold mono">EDITED {entry.editCount}x</span>}
                   </div>
                   <p className="text-sm leading-relaxed">{entry.content}</p>
                   {entry.fileUrl && (
                     <a href={entry.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-4 text-[10px] font-bold underline uppercase tracking-tighter hover:text-blue-600">
                       <FileUp size={12} /> View Artifact
                     </a>
                   )}
                </div>
             </div>
           ))}
        </div>
      </div>
    );
  }

  if (tab === 'reports') {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-3xl font-bold italic serif">Formal Reporting.</h2>
          <p className="text-gray-500 text-sm mt-1 mono uppercase tracking-widest">Submit midterm and final assessments</p>
        </header>

        <div className="grid grid-cols-2 gap-8">
           {/* Submission Form */}
           <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
              <h3 className="font-bold flex items-center gap-2 mb-6">
                <FileText size={18} /> New Report Upload
              </h3>
              <div className="space-y-4">
                 <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-1">Report Type</label>
                    <div className="flex gap-4">
                       {(['midterm', 'final'] as const).map(t => (
                         <button 
                           key={t}
                           onClick={() => setReportType(t)}
                           className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest border border-[#141414] transition-all ${reportType === t ? 'bg-[#141414] text-white' : 'hover:bg-gray-50'}`}
                         >
                           {t}
                         </button>
                       ))}
                    </div>
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-1">Project Title</label>
                    <input 
                      type="text"
                      value={reportTitle}
                      onChange={(e) => setReportTitle(e.target.value)}
                      placeholder="e.g. Analysis of Cloud Infrastructure..."
                      className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                    />
                 </div>
                 <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-1">Document Link (PDF/DOCX)</label>
                    <input 
                      type="text"
                      value={reportUrl}
                      onChange={(e) => setReportUrl(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                    />
                 </div>
                 <button 
                   onClick={handleSubmitReport}
                   className="w-full bg-[#141414] text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center justify-center gap-2"
                 >
                   <Send size={16} /> Lodge Report
                 </button>
              </div>
           </div>

           {/* Submission History */}
           <div className="space-y-4">
              <h3 className="font-bold text-xs uppercase tracking-widest mono text-gray-400">Past Submissions</h3>
              {reports.map(report => (
                <div key={report.id} className="bg-white border border-gray-200 p-4">
                   <div className="flex justify-between items-start mb-2">
                      <div>
                         <span className="text-[8px] font-black uppercase bg-[#141414] text-white px-2 py-0.5 mono">
                           {report.type}
                         </span>
                         <h4 className="font-bold text-sm mt-1">{report.title}</h4>
                      </div>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${
                        report.status === 'approved' ? 'bg-green-100 text-green-700' :
                        report.status === 'revision' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-400'
                      }`}>
                         {report.status}
                      </span>
                   </div>
                   <p className="text-[10px] text-gray-400 mono">{format(new Date(report.submittedAt), 'PP')}</p>
                   {report.feedback && (
                     <div className="mt-3 p-2 bg-gray-50 border-l-2 border-gray-200">
                        <p className="text-[10px] italic text-gray-600">"{report.feedback}"</p>
                     </div>
                   )}
                   <a 
                     href={report.fileUrl} 
                     target="_blank" 
                     rel="noreferrer"
                     className="inline-flex items-center gap-1 mt-4 text-[10px] font-bold underline uppercase tracking-tight hover:text-blue-600"
                   >
                     <FileUp size={12} /> Open Document
                   </a>
                </div>
              ))}
              {reports.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-gray-100 text-gray-300">
                   <FileText size={40} className="mx-auto mb-2 opacity-20" />
                   <p className="italic serif">No reports filed yet.</p>
                </div>
              )}
           </div>
        </div>
      </div>
    );
  }

  if (tab === 'applications') {
    return (
      <div className="space-y-8">
        <header>
          <h2 className="text-3xl font-bold italic serif">Placement Applications.</h2>
          <p className="text-gray-500 text-sm mt-1 mono uppercase tracking-widest">Browse companies and submit applications</p>
        </header>

        {/* Current Placement Status */}
        {placement && (
          <div className={`p-6 border-2 ${
            placement.status === 'ongoing' ? 'border-green-500 bg-green-50' :
            placement.status === 'approved' ? 'border-blue-500 bg-blue-50' :
            placement.status === 'pending' ? 'border-orange-500 bg-orange-50' :
            'border-gray-300 bg-gray-50'
          }`}>
            <div className="flex items-start justify-between">
              <div>
                <span className={`text-[8px] font-black uppercase px-2 py-1 ${
                  placement.status === 'ongoing' ? 'bg-green-600 text-white' :
                  placement.status === 'approved' ? 'bg-blue-600 text-white' :
                  placement.status === 'pending' ? 'bg-orange-600 text-white' :
                  'bg-gray-600 text-white'
                }`}>
                  {placement.status}
                </span>
                <h3 className="font-bold text-lg mt-2">
                  {companies.find(c => c.id === placement.companyId)?.name || 'Company'}
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  {placement.status === 'pending' && 'Your application is under review by the coordinator.'}
                  {placement.status === 'approved' && 'Congratulations! Your placement has been approved. Accept the offer to begin.'}
                  {placement.status === 'ongoing' && `Internship started on ${format(new Date(placement.startDate || placement.createdAt), 'PP')}`}
                  {placement.status === 'rejected' && 'This placement was not approved. You may apply to other companies.'}
                </p>
              </div>
              {placement.status === 'approved' && (
                <div className="flex gap-2">
                  <button 
                    onClick={() => handlePlacementAction('ongoing')}
                    className="bg-green-600 text-white px-4 py-2 text-xs font-bold uppercase hover:bg-green-700 transition-all flex items-center gap-1"
                  >
                    <Check size={14} /> Accept
                  </button>
                  <button 
                    onClick={() => handlePlacementAction('rejected')}
                    className="border border-gray-300 text-gray-700 px-4 py-2 text-xs font-bold uppercase hover:bg-gray-100 transition-all flex items-center gap-1"
                  >
                    <X size={14} /> Decline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Eligibility Check */}
        {!studentData?.isEligible && (
          <div className="bg-red-50 border-2 border-red-500 p-6">
            <div className="flex items-start gap-3">
              <AlertCircle size={24} className="text-red-600 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-red-900">Not Eligible for Placement</h3>
                <p className="text-sm text-red-700 mt-1">
                  You must meet the minimum requirements (80+ credits and 2.0+ GPA) before applying for internships.
                  Please check your dashboard for current progress.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Application Form - Only show if eligible and no active placement */}
        {studentData?.isEligible && !placement && (
          <div className="bg-white border border-[#141414] p-8 shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
            <h3 className="font-bold flex items-center gap-2 mb-6">
              <Plus size={18} /> Submit New Application
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mono mb-2">
                  Select Company
                </label>
                <select 
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full bg-gray-50 border border-[#141414] p-3 text-sm outline-none"
                >
                  <option value="">-- Choose a company --</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name} - {company.industry}
                    </option>
                  ))}
                </select>
              </div>
              <button 
                onClick={handleApply}
                disabled={!selectedCompanyId}
                className="w-full bg-[#141414] text-white py-4 font-black text-xs uppercase tracking-widest hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Send size={16} /> Submit Application
              </button>
            </div>
          </div>
        )}

        {/* Available Companies List */}
        <div>
          <h3 className="font-bold text-xs uppercase tracking-widest mono text-gray-400 mb-4">
            Available Companies ({companies.length})
          </h3>
          <div className="grid grid-cols-2 gap-6">
            {companies.map(company => (
              <div key={company.id} className="bg-white border border-gray-200 p-6 hover:border-[#141414] transition-all">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-lg">{company.name}</h4>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mono">
                      {company.industry}
                    </span>
                  </div>
                  <Briefcase size={20} className="text-gray-400" />
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-4">
                  {company.description || 'Leading company in the industry offering comprehensive internship programs.'}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 mono">
                  <span>📍 {company.location || 'Multiple Locations'}</span>
                </div>
              </div>
            ))}
            {companies.length === 0 && (
              <div className="col-span-2 py-20 text-center border-2 border-dashed border-gray-100 text-gray-300">
                <Briefcase size={40} className="mx-auto mb-2 opacity-20" />
                <p className="italic serif">No companies available at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (tab === 'notifications') {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <h2 className="text-3xl font-bold italic serif">Inbox.</h2>
        <div className="space-y-3">
          {notifications.map(notif => (
            <div key={notif.id} className={`p-4 border border-[#141414] bg-white shadow-[2px_2px_0px_0px_rgba(20,20,20,1)] ${!notif.read ? 'border-l-4 border-l-blue-500' : ''}`}>
               <div className="flex justify-between items-start">
                  <h4 className="font-bold text-sm">{notif.title}</h4>
                  <span className="text-[10px] text-gray-400 mono">{format(new Date(notif.createdAt), 'MMM d')}</span>
               </div>
               <p className="text-xs text-gray-600 mt-1">{notif.message}</p>
               {notif.deadline && (
                 <div className="mt-2 flex items-center gap-1 text-[10px] text-red-500 font-bold mono">
                   <Calendar size={10} /> DUE: {format(new Date(notif.deadline), 'PP')}
                 </div>
               )}
            </div>
          ))}
          {notifications.length === 0 && <p className="text-center py-20 text-gray-400 italic">No messages found.</p>}
        </div>
      </div>
    );
  }

  return <div className="p-20 text-center text-gray-400">Section available in full version.</div>;
}

function StatusCard({ title, value, status }: { title: string, value: string, status: 'success' | 'error' | 'warning' | 'info' | 'neutral' }) {
  const colors = {
    success: 'border-green-500 text-green-700 bg-green-50',
    error: 'border-red-500 text-red-700 bg-red-50',
    warning: 'border-orange-500 text-orange-700 bg-orange-50',
    info: 'border-blue-500 text-blue-700 bg-blue-50',
    neutral: 'border-gray-300 text-gray-500 bg-gray-50'
  };

  return (
    <div className={`p-6 border-l-4 shadow-[2px_2px_0px_0px_rgba(20,20,20,0.05)] ${colors[status]}`}>
      <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mono">{title}</p>
      <p className="text-2xl font-black mt-1 tracking-tight">{value}</p>
    </div>
  );
}

function ProgressBar({ label, current, target, isGPA }: { label: string, current: number, target: number, isGPA?: boolean }) {
  const progress = Math.min((current / target) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[10px] font-bold uppercase mono text-gray-500 mb-1">
        <span>{label}</span>
        <span>{current.toFixed(isGPA ? 2 : 0)} / {target.toFixed(isGPA ? 2 : 0)}</span>
      </div>
      <div className="h-1.5 bg-gray-100 border border-gray-200 overflow-hidden">
        <div className="h-full bg-[#141414]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
