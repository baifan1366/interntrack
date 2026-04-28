export type UserRole = 'student' | 'supervisor' | 'coordinator';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface StudentData {
  id: string;
  userId: string;
  programme: string;
  creditsEarned: number;
  requiredCredits: number;
  gpa: number;
  isEligible: boolean;
}

export interface Company {
  id: string;
  name: string;
  contactPerson: string;
  email: string;
  approved: boolean;
}

export interface Placement {
  id: string;
  studentId: string;
  companyId: string;
  status: 'pending' | 'approved' | 'rejected' | 'ongoing' | 'completed';
  offerDate?: string;
  startDate?: string;
  endDate?: string;
}

export interface LogbookEntry {
  id: string;
  studentId: string;
  weekNumber: number;
  content: string;
  fileUrl?: string;
  createdAt: string;
  updatedAt?: string;
  editCount: number;
  isAutoSubmitted: boolean;
}

export interface Evaluation {
  id: string;
  studentId: string;
  evaluatorId: string;
  type: 'industry' | 'academic';
  scores: {
    performance: number;
    discipline: number;
    technicalSkills: number;
    communication: number;
  };
  totalScore: number;
  feedback: string;
  submittedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type: 'alert' | 'update' | 'warning';
  createdAt: string;
  deadline?: string;
}

export interface Report {
  id: string;
  studentId: string;
  type: 'midterm' | 'final';
  title: string;
  fileUrl: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'revision';
  feedback?: string;
}
