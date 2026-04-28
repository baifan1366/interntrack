import { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, getDocs, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, Placement, StudentData, Evaluation } from '../types';
import { Star, FileText, CheckCircle, Award, User, Target } from 'lucide-react';
import { DashboardSkeleton } from '../components/Skeleton';

export default function SupervisorPortal({ tab, user }: { tab: string, user: UserProfile }) {
  const [students, setStudents] = useState<{ student: StudentData, user: UserProfile, placement: Placement }[]>([]);
  const [loading, setLoading] = useState(true);

  // Evaluation form
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [scores, setScores] = useState({
    performance: 0,
    discipline: 0,
    technicalSkills: 0,
    communication: 0
  });
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const plSnap = await getDocs(collection(db, 'placements'));
        const ongoingPlacements = plSnap.docs
          .map(d => ({ id: d.id, ...d.data() }) as Placement)
          .filter(p => p.status === 'ongoing');
        
        const results = [];
        for (const p of ongoingPlacements) {
           const sDoc = await getDoc(doc(db, 'students', p.studentId));
           if (!sDoc.exists()) continue;
           const sData = { id: sDoc.id, ...sDoc.data() } as StudentData;
           const uDoc = await getDoc(doc(db, 'users', sData.userId));
           if (!uDoc.exists()) continue;
           const uData = { id: uDoc.id, ...uDoc.data() } as UserProfile;
           results.push({ student: sData, user: uData, placement: p });
        }
        setStudents(results);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, 'supervisor data');
      }
      setTimeout(() => setLoading(false), 600);
    };

    fetchData();
  }, []);

  const totalScore = (Object.values(scores).reduce((a, b) => a + b, 0) / 4);

  const handleSubmitEvaluation = async () => {
    if (!selectedStudentId || !feedback) return;

    try {
      await addDoc(collection(db, 'evaluations'), {
        studentId: selectedStudentId,
        evaluatorId: user.id,
        type: 'industry',
        scores,
        totalScore,
        feedback,
        submittedAt: new Date().toISOString()
      });

      // Update student record if needed or just notify
      await addDoc(collection(db, 'notifications'), {
        userId: students.find(s => s.student.id === selectedStudentId)?.user.id,
        title: 'Performance Evaluation Submitted',
        message: `Your supervisor ${user.name} has submitted your final industry assessment.`,
        read: false,
        type: 'update',
        createdAt: new Date().toISOString()
      });

      alert("Evaluation synchronized.");
      setSelectedStudentId('');
      setScores({ performance: 0, discipline: 0, technicalSkills: 0, communication: 0 });
      setFeedback('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'evaluations');
    }
  };

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-4xl font-bold tracking-tight text-[#141414]">Supervisor Console.</h2>
        <p className="text-gray-500 mt-2 italic serif">Assessing performance and ethical conduct.</p>
      </header>

      <div className="grid grid-cols-2 gap-8">
        <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)]">
           <div className="p-4 border-b border-[#141414] bg-gray-50 flex items-center gap-2">
              <User size={14} className="text-gray-400" />
              <h3 className="font-bold text-xs uppercase tracking-widest mono">Assigned Interns</h3>
           </div>
           <div className="divide-y divide-gray-100 max-h-[500px] overflow-auto">
              {students.map(item => (
                <div key={item.student.id} 
                  className={`p-4 flex justify-between items-center hover:bg-gray-50 transition-colors ${selectedStudentId === item.student.id ? 'bg-gray-50' : ''}`}
                >
                   <div>
                     <p className="font-bold text-sm">{item.user.name}</p>
                     <p className="text-[10px] text-gray-500 mono uppercase">{item.student.programme}</p>
                   </div>
                   <button 
                     onClick={() => setSelectedStudentId(item.student.id)}
                     className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest border border-[#141414] transition-all ${
                       selectedStudentId === item.student.id ? 'bg-[#141414] text-white' : 'hover:bg-[#141414] hover:text-white'
                     }`}
                    >
                     {selectedStudentId === item.student.id ? 'Active' : 'Evaluate'}
                   </button>
                </div>
              ))}
              {students.length === 0 && <p className="p-8 text-center text-gray-400 text-xs">No active interns requiring evaluation.</p>}
           </div>
        </section>

        {selectedStudentId ? (
          <section className="bg-white border border-[#141414] shadow-[4px_4px_0px_0px_rgba(20,20,20,1)] p-6 overflow-auto max-h-[700px]">
             <div className="flex justify-between items-start mb-8">
                <div>
                   <h3 className="text-xl font-bold italic serif">Rubric Assessment</h3>
                   <p className="text-[10px] text-gray-400 mt-1 mono">{students.find(s => s.student.id === selectedStudentId)?.user.name}</p>
                </div>
                <div className="text-right">
                   <p className="text-[10px] font-bold text-gray-400 mono">TOTAL SCORE</p>
                   <p className="text-3xl font-black">{totalScore.toFixed(0)}%</p>
                </div>
             </div>
             
             <div className="space-y-6">
                <RubricSlider 
                  label="Work Performance" 
                  value={scores.performance} 
                  onChange={(v) => setScores({ ...scores, performance: v })} 
                  description="Quality of deliverables and task completion speed."
                />
                <RubricSlider 
                  label="Discipline & Ethics" 
                  value={scores.discipline} 
                  onChange={(v) => setScores({ ...scores, discipline: v })} 
                  description="Punctuality, dress code, and professional conduct."
                />
                <RubricSlider 
                  label="Technical Competence" 
                  value={scores.technicalSkills} 
                  onChange={(v) => setScores({ ...scores, technicalSkills: v })} 
                  description="Ability to apply programme knowledge to industry tasks."
                />
                <RubricSlider 
                  label="Communication" 
                  value={scores.communication} 
                  onChange={(v) => setScores({ ...scores, communication: v })} 
                  description="Ability to relay information and work in team settings."
                />

                <div className="pt-4">
                   <label className="block text-[10px] font-bold uppercase tracking-widest text-[#141414] mono mb-2">Qualitative Appraisal</label>
                   <textarea 
                     value={feedback} 
                     onChange={(e) => setFeedback(e.target.value)}
                     className="w-full h-32 bg-gray-50 border border-[#141414] p-3 text-sm outline-none resize-none"
                     placeholder="Provide detailed feedback on professional growth..."
                   />
                </div>

                <button 
                  onClick={handleSubmitEvaluation}
                  className="w-full bg-[#141414] text-white font-black py-4 hover:bg-gray-800 transition-all flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                >
                  <Award size={18} />
                  Archive Assessment
                </button>
             </div>
          </section>
        ) : (
          <div className="flex items-center justify-center border-2 border-dashed border-gray-200 text-gray-400 p-20 text-center">
            <div className="space-y-4">
              <Target size={40} className="mx-auto opacity-20" />
              <p className="italic serif">Select an intern to begin the formal evaluation process.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RubricSlider({ label, value, onChange, description }: { label: string, value: number, onChange: (v: number) => void, description: string }) {
  return (
    <div className="space-y-2">
       <div className="flex justify-between items-end">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-tight">{label}</h4>
            <p className="text-[10px] text-gray-500">{description}</p>
          </div>
          <span className="text-sm font-black mono">{value}%</span>
       </div>
       <input 
         type="range" 
         min="0" 
         max="100" 
         step="5"
         value={value} 
         onChange={(e) => onChange(Number(e.target.value))}
         className="w-full h-1 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-[#141414]"
       />
    </div>
  );
}

