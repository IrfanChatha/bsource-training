"use client";
import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { supabaseService, DEFAULT_SETTINGS } from '@/lib/services/supabaseService';
import {
  Users,
  GraduationCap,
  Calendar,
  Award,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  ExternalLink,
  Shield,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Download,
  Clock,
  QrCode,
  FileText,
  Sliders,
  AlertTriangle,
  Building,
  Mail,
  User,
  Check,
  X,
  Activity,
  ArrowUpRight
} from 'lucide-react';

export default function AdminDashboardPage() {
  const { showToast, navigate } = useApp();
  
  // Data States
  const [users, setUsers] = useState([]);
  const [trainings, setTrainings] = useState([]);
  const [attendanceLogs, setAttendanceLogs] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Active Tab
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'trainings' | 'attendance' | 'settings'

  // User Filter & Search
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  // Training Filter & Search
  const [trainingSearch, setTrainingSearch] = useState('');
  const [trainingStatusFilter, setTrainingStatusFilter] = useState('all');

  // Modals
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // New User Form State
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState('trainee');
  const [newUserDepartment, setNewUserDepartment] = useState('Engineering');
  const [newUserSpecialty, setNewUserSpecialty] = useState('');
  const [newUserCohort, setNewUserCohort] = useState('');
  const [savingUser, setSavingUser] = useState(false);

  // Edit User Form State
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('trainee');
  const [editDepartment, setEditDepartment] = useState('Engineering');

  // System Settings State
  const [qrInterval, setQrInterval] = useState(DEFAULT_SETTINGS.qr_rotation_seconds);
  const [aiModel, setAiModel] = useState(DEFAULT_SETTINGS.ai_model);
  const [passingScore, setPassingScore] = useState(DEFAULT_SETTINGS.passing_score);
  const [defaultQuizQuestions, setDefaultQuizQuestions] = useState(DEFAULT_SETTINGS.default_question_count);
  const [allowRetriesDefault, setAllowRetriesDefault] = useState(DEFAULT_SETTINGS.allow_quiz_retries_default);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await supabaseService.saveSettings({
        qr_rotation_seconds: qrInterval,
        ai_model: aiModel,
        passing_score: passingScore,
        default_question_count: defaultQuizQuestions,
        allow_quiz_retries_default: allowRetriesDefault,
      });
      showToast('System policies saved.', 'success');
    } catch (err) {
      showToast(err?.message || 'Failed to save system policies', 'error');
    } finally {
      setSavingSettings(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const [u, t, att, attempts] = await Promise.all([
        supabaseService.getAllUsers(),
        supabaseService.getTrainings(),
        supabaseService.getAllAttendanceLogs(),
        supabaseService.getAllQuizAttempts()
      ]);
      setUsers(u || []);
      setTrainings(t || []);
      setAttendanceLogs(att || []);
      setQuizAttempts(attempts || []);

      const settings = await supabaseService.getSettings().catch(() => DEFAULT_SETTINGS);
      setQrInterval(settings.qr_rotation_seconds);
      setAiModel(settings.ai_model);
      setPassingScore(settings.passing_score);
      setDefaultQuizQuestions(settings.default_question_count);
      setAllowRetriesDefault(settings.allow_quiz_retries_default);
    } catch {
      showToast('Error loading administrative statistics', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Kick the first load off the effect body so it does not setState
    // synchronously during the commit.
    const raf = requestAnimationFrame(() => loadAdminData());
    const unsub = supabaseService.onRealtimeUpdate(() => loadAdminData());
    return () => {
      cancelAnimationFrame(raf);
      if (typeof unsub === 'function') unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAdminData();
    showToast('Admin data refreshed from Supabase.', 'info');
  };

  // User Actions
  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) {
      showToast('Name and email are required', 'error');
      return;
    }
    setSavingUser(true);
    try {
      await supabaseService.createUser({
        full_name: newUserName.trim(),
        email: newUserEmail.trim().toLowerCase(),
        role: newUserRole,
        department: newUserDepartment,
        specialty: newUserSpecialty,
        cohort: newUserCohort
      });
      showToast(
        `Reserved a ${newUserRole} profile for ${newUserEmail}. They can now sign up with that address.`,
        'success'
      );
      setShowAddUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      await loadAdminData();
    } catch (err) {
      showToast(err?.message || 'Failed to create user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSavingUser(true);
    try {
      await supabaseService.updateUserProfile(selectedUser.id, {
        full_name: editName.trim(),
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        department: editDepartment
      });
      showToast('Employee profile updated.', 'success');
      setShowEditUserModal(false);
      await loadAdminData();
    } catch (err) {
      showToast(err?.message || 'Failed to update user', 'error');
    } finally {
      setSavingUser(false);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to remove user "${userName}" from the system?`)) return;
    try {
      await supabaseService.deleteUser(userId);
      showToast(`User ${userName} removed.`, 'info');
      await loadAdminData();
    } catch (err) {
      showToast(err?.message || 'Failed to remove user', 'error');
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await supabaseService.updateUserRole(userId, newRole);
      showToast(`Updated user role to ${newRole.toUpperCase()}`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast(err?.message || 'Failed to update role', 'error');
    }
  };

  // Training Actions
  const handleTogglePublish = async (training) => {
    try {
      await supabaseService.updateTraining(training.id, {
        is_published: !training.is_published
      });
      showToast(`Training ${!training.is_published ? 'published' : 'unpublished'}`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast('Failed to update training publish state', 'error');
    }
  };

  const handleStatusChange = async (training, newStatus) => {
    try {
      await supabaseService.updateTraining(training.id, { status: newStatus });
      showToast(`Training status changed to ${newStatus}`, 'success');
      await loadAdminData();
    } catch (err) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDeleteTraining = async (id, title) => {
    if (!confirm(`Delete training course "${title}"? This cannot be undone.`)) return;
    try {
      await supabaseService.deleteTraining(id);
      showToast('Training session deleted', 'info');
      await loadAdminData();
    } catch (err) {
      showToast(err?.message || 'Failed to delete training', 'error');
    }
  };

  /**
   * Quotes a value for CSV. The previous export pasted raw values into a
   * `data:` URI and ran them through encodeURI, which leaves `#` untouched, so
   * everything after the first `#` in any field was silently dropped.
   */
  const csvCell = (value) => {
    const str = value === null || value === undefined ? '' : String(value);
    return '"' + str.replace(/"/g, '""') + '"';
  };

  const exportCSV = (type) => {
    let headers = [];
    let rows = [];
    const filename = `bsource_${type}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (type === 'attendance') {
      headers = ['Attendance ID', 'Training ID', 'Trainee ID', 'Trainee Name', 'Timestamp', 'Token Verified'];
      rows = attendanceLogs.map((a) => [
        a.id, a.training_id, a.trainee_id, a.trainee_name || 'Participant', a.marked_at, a.verified_by_token || '',
      ]);
    } else if (type === 'users') {
      headers = ['User ID', 'Full Name', 'Email', 'Role', 'Department', 'Created At'];
      rows = users.map((u) => [
        u.id, u.full_name || u.name || '', u.email, u.role, u.department || '', u.created_at || '',
      ]);
    } else {
      headers = ['Training ID', 'Title', 'Trainer Name', 'Date', 'Time', 'Status', 'Published'];
      rows = trainings.map((t) => [
        t.id, t.title, t.trainer_name, t.date, t.time, t.status, t.is_published ? 'Yes' : 'No',
      ]);
    }

    if (rows.length === 0) {
      showToast(`There is no ${type} data to export yet.`, 'warning');
      return;
    }

    // A leading BOM keeps Excel from mangling non-ASCII names.
    const csv = '\uFEFF' + [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast(`Exported ${rows.length} ${type} rows to CSV`, 'success');
  };

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const name = u.full_name || u.name || '';
    const email = u.email || '';
    const dept = u.department || '';
    const matchesSearch =
      name.toLowerCase().includes(userSearch.toLowerCase()) ||
      email.toLowerCase().includes(userSearch.toLowerCase()) ||
      dept.toLowerCase().includes(userSearch.toLowerCase());
    return matchesRole && matchesSearch;
  });

  // Filtered Trainings
  const filteredTrainings = trainings.filter((t) => {
    const matchesStatus = trainingStatusFilter === 'all' || t.status === trainingStatusFilter;
    const matchesSearch =
      (t.title || '').toLowerCase().includes(trainingSearch.toLowerCase()) ||
      (t.trainer_name || '').toLowerCase().includes(trainingSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // KPI Calculations
  const totalUsers = users.length;
  const totalTrainers = users.filter((u) => u.role === 'trainer').length;
  const totalTrainees = users.filter((u) => u.role === 'trainee').length;
  const totalAdmins = users.filter((u) => u.role === 'admin').length;
  const totalSessions = trainings.length;
  const activeSessions = trainings.filter((t) => t.status === 'in_progress').length;
  const completedSessions = trainings.filter((t) => t.status === 'completed').length;
  const totalCheckIns = attendanceLogs.length;
  const totalAttempts = quizAttempts.length;
  // Shows a dash rather than a placeholder number when nobody has been graded.
  const avgScore = quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((acc, a) => acc + (Number(a.percentage) || 0), 0) / quizAttempts.length)
    : null;

  // Department Distribution
  const departmentCounts = users.reduce((acc, u) => {
    const dept = u.department || 'General';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase rounded-md bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/50 flex items-center gap-1">
              <Shield className="w-3 h-3" />
              Enterprise Administration
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            Admin Governance & Control Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            System-wide oversight across workforce accounts, live attendance check-ins, curriculum audit logs, and AI evaluation metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
            title="Refresh Realtime Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => exportCSV('attendance')}
            className="px-3.5 py-2.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Audit CSV</span>
          </button>

          <button
            onClick={() => setShowAddUserModal(true)}
            className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Provision User</span>
          </button>
        </div>
      </div>

      {/* Admin Tab Navigation Bar */}
      <div className="flex items-center gap-1 overflow-x-auto p-1.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-inner">
        {[
          { id: 'overview', label: 'Workforce Analytics', icon: <Activity className="w-4 h-4" /> },
          { id: 'users', label: `User Directory (${totalUsers})`, icon: <Users className="w-4 h-4" /> },
          { id: 'trainings', label: `Training Courses (${totalSessions})`, icon: <Calendar className="w-4 h-4" /> },
          { id: 'attendance', label: `Live Attendance Logs (${totalCheckIns})`, icon: <QrCode className="w-4 h-4" /> },
          { id: 'settings', label: 'System Policies & AI', icon: <Sliders className="w-4 h-4" /> }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/40'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* KPI Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Workforce Base</span>
                <Users className="w-4 h-4 text-purple-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{totalUsers}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {totalTrainees} Trainees • {totalTrainers} Trainers • {totalAdmins} Admins
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Corporate Trainings</span>
                <Calendar className="w-4 h-4 text-indigo-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{totalSessions}</p>
              <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold mt-1">
                {activeSessions} Live Sessions Active
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Verified Attendance</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{totalCheckIns}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Captured via 60s Dynamic QR Codes
              </p>
            </div>

            <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
                <span>Avg Quiz Pass Rate</span>
                <Award className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-black text-slate-900 dark:text-white">{avgScore === null ? '\u2014' : `${avgScore}%`}</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {totalAttempts} completed AI assessments
              </p>
            </div>
          </div>

          {/* Department Breakdown & Live Status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Adoption */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Department Workforce Adoption
                </h3>
                <span className="text-xs text-slate-400">Realtime User Metrics</span>
              </div>

              <div className="space-y-3">
                {Object.entries(departmentCounts).map(([dept, count]) => {
                  const percentage = Math.round((count / Math.max(totalUsers, 1)) * 100);
                  return (
                    <div key={dept} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-slate-800 dark:text-slate-200">{dept}</span>
                        <span className="text-slate-500 dark:text-slate-400">{count} employees ({percentage}%)</span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
                          style={{ width: `${Math.max(percentage, 5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Admin Actions & Direct Hub Links */}
            <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Workspace Shortcuts
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Jump into trainer creation workflows or view live attendance stream.
              </p>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => navigate('/trainer/trainings')}
                  className="w-full p-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-indigo-200/50 dark:border-indigo-800/60"
                >
                  <span className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Open Trainer Hub
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/trainer/attendance')}
                  className="w-full p-3 rounded-2xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer border border-purple-200/50 dark:border-purple-800/60"
                >
                  <span className="flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    Project Dynamic 60s QR
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>

                <button
                  onClick={() => navigate('/trainer/quiz')}
                  className="w-full p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    AI Quiz Generator
                  </span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: USER DIRECTORY & ROLE MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Workforce Directory & Role Reassignment
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage user permissions, update departments, and promote instructors.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user, email or dept..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              >
                <option value="all">All Roles</option>
                <option value="admin">Admins</option>
                <option value="trainer">Trainers</option>
                <option value="trainee">Trainees</option>
              </select>

              <button
                onClick={() => exportCSV('users')}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                title="Export Users to CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="pb-3 pl-1">Employee</th>
                  <th className="pb-3">Department</th>
                  <th className="pb-3">Active Role</th>
                  <th className="pb-3">Change Role</th>
                  <th className="pb-3 text-right pr-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No employees match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-1">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shadow-xs">
                            {(user.full_name || user.name || 'U').charAt(0)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white">{user.full_name || user.name}</p>
                            <p className="text-[10px] text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 text-slate-600 dark:text-slate-300 font-medium">
                        {user.department || 'General Operations'}
                      </td>

                      <td className="py-3">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200/50'
                              : user.role === 'trainer'
                              ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200/50'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200/50'
                          }`}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="py-3">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-purple-500 cursor-pointer"
                        >
                          <option value="trainee">Trainee</option>
                          <option value="trainer">Trainer</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      <td className="py-3 text-right pr-2">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setEditName(user.full_name || user.name || '');
                              setEditEmail(user.email || '');
                              setEditRole(user.role || 'trainee');
                              setEditDepartment(user.department || 'Engineering');
                              setShowEditUserModal(true);
                            }}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Edit User Details"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleDeleteUser(user.id, user.full_name || user.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Remove User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: TRAINING COURSES AUDIT */}
      {activeTab === 'trainings' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                All Corporate Training Sessions
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit curriculum across all instructors, change publish visibility, and review status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-48 sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={trainingSearch}
                  onChange={(e) => setTrainingSearch(e.target.value)}
                  placeholder="Search training or instructor..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <select
                value={trainingStatusFilter}
                onChange={(e) => setTrainingStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white capitalize"
              >
                <option value="all">All Statuses</option>
                <option value="in_progress">Live (In Progress)</option>
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
              </select>

              <button
                onClick={() => exportCSV('trainings')}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg cursor-pointer"
                title="Export Trainings to CSV"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="pb-3 pl-1">Course Title</th>
                  <th className="pb-3">Instructor</th>
                  <th className="pb-3">Schedule</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3">Visibility</th>
                  <th className="pb-3 text-right pr-2">Admin Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredTrainings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      No training sessions match your search.
                    </td>
                  </tr>
                ) : (
                  filteredTrainings.map((training) => (
                    <tr key={training.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-1 max-w-[220px]">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{training.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{training.location || 'Online'}</p>
                      </td>

                      <td className="py-3 font-medium text-slate-700 dark:text-slate-300">
                        {training.trainer_name || 'Staff Instructor'}
                      </td>

                      <td className="py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div>{training.date}</div>
                        <div className="text-[10px] opacity-75">{training.time} ({training.duration_minutes}m)</div>
                      </td>

                      <td className="py-3">
                        <select
                          value={training.status}
                          onChange={(e) => handleStatusChange(training, e.target.value)}
                          className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                        >
                          <option value="upcoming">Upcoming</option>
                          <option value="in_progress">Live / In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </td>

                      <td className="py-3">
                        <button
                          onClick={() => handleTogglePublish(training)}
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                            training.is_published
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300/60'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {training.is_published ? 'Published' : 'Draft / Hidden'}
                        </button>
                      </td>

                      <td className="py-3 text-right pr-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => navigate(`/training/${training.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold text-[11px] cursor-pointer"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => handleDeleteTraining(training.id, training.title)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Delete Training"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ATTENDANCE & COMPLIANCE LOGS */}
      {activeTab === 'attendance' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Live Attendance & Verification Audit Stream
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Full chronological ledger of verified 60s dynamic QR code token check-ins.
              </p>
            </div>

            <button
              onClick={() => exportCSV('attendance')}
              className="px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Compliance Ledger CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider text-[10px] font-bold">
                  <th className="pb-3 pl-1">Trainee / Attendee</th>
                  <th className="pb-3">Training Course</th>
                  <th className="pb-3">Check-In Timestamp</th>
                  <th className="pb-3">Verification Token</th>
                  <th className="pb-3 text-right pr-2">Verification Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {attendanceLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      No attendance records logged yet. Once trainees scan QR codes, records will stream here.
                    </td>
                  </tr>
                ) : (
                  attendanceLogs.map((log, idx) => (
                    <tr key={log.id ? `${log.id}-${idx}` : `log-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 pl-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs">
                            {(log.trainee_name || 'T').charAt(0)}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">{log.trainee_name || 'Employee'}</p>
                            <p className="text-[10px] text-slate-400">{log.trainee_id}</p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 font-semibold text-slate-700 dark:text-slate-300">
                        {log.training_title || `Course ID: ${log.training_id}`}
                      </td>

                      <td className="py-3 text-slate-500 dark:text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{log.marked_at ? new Date(log.marked_at).toLocaleString() : 'Recent'}</span>
                        </div>
                      </td>

                      <td className="py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                          {log.token_used || '60s-rot-token'}
                        </span>
                      </td>

                      <td className="py-3 text-right pr-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          Verified Present
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM POLICIES & AI CONFIGURATION */}
      {activeTab === 'settings' && (
        <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6 animate-in fade-in duration-200 max-w-3xl">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Enterprise Governance & AI Model Settings
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure dynamic token expiration windows, assessment thresholds, and AI prompt synthesis settings.
            </p>
          </div>

          <div className="space-y-4">
            {/* Dynamic QR Rotation Timer */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Dynamic QR Code Rotation Window (Seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={15}
                  max={300}
                  step={15}
                  value={qrInterval}
                  onChange={(e) => setQrInterval(Number(e.target.value))}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Default is 60s. Auto-rotates token projection to eliminate screenshot sharing.
                </span>
              </div>
            </div>

            {/* AI Model Selection */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Google Gemini AI Model Engine
              </label>
              <select
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                className="w-full sm:w-80 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Recommended - low latency)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro (Deep document analysis)</option>
                <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
              </select>
            </div>

            {/* Assessment Passing Score Threshold */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                AI Assessment Passing Score Threshold (%)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={50}
                  max={100}
                  step={5}
                  value={passingScore}
                  onChange={(e) => setPassingScore(Number(e.target.value))}
                  className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Trainees must achieve this score or higher to earn an official pass certification badge.
                </span>
              </div>
            </div>

            {/* Questions per Quiz */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                Default Generated Question Count
              </label>
              <input
                type="number"
                min={4}
                max={20}
                value={defaultQuizQuestions}
                onChange={(e) => setDefaultQuizQuestions(Number(e.target.value))}
                className="w-32 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white font-bold"
              />
            </div>

            {/* Quiz Retries Policy */}
            <div className="flex items-center gap-3 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <input
                type="checkbox"
                id="retriesDefault"
                checked={allowRetriesDefault}
                onChange={(e) => setAllowRetriesDefault(e.target.checked)}
                className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
              />
              <label htmlFor="retriesDefault" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                Enable Trainee Quiz Retries by default on new corporate training courses
              </label>
            </div>

            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="px-6 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 disabled:opacity-50 cursor-pointer transition-all"
            >
              {savingSettings ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Provision New User */}
      {showAddUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Provision Workforce Employee
                </h3>
                <p className="text-xs text-slate-400">
                  Reserves a role and department for this email address. The
                  employee still signs up themselves, and their account adopts
                  these settings on first sign-in.
                </p>
              </div>
              <button
                onClick={() => setShowAddUserModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. David Vance"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="david.vance@enterprise.com"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="trainee">Trainee</option>
                    <option value="trainer">Trainer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={newUserDepartment}
                    onChange={(e) => setNewUserDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Learning & Development">Learning & Development</option>
                    <option value="Security Operations">Security Operations</option>
                    <option value="Product Design">Product Design</option>
                    <option value="Executive Governance">Executive Governance</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Provisioning...' : 'Provision User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Edit User */}
      {showEditUserModal && selectedUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Edit Employee Profile
                </h3>
                <p className="text-xs text-slate-400">
                  Update personal information and organizational assignment.
                </p>
              </div>
              <button
                onClick={() => setShowEditUserModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Role
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="trainee">Trainee</option>
                    <option value="trainer">Trainer</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Department
                  </label>
                  <select
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  >
                    <option value="Engineering">Engineering</option>
                    <option value="Learning & Development">Learning & Development</option>
                    <option value="Security Operations">Security Operations</option>
                    <option value="Product Design">Product Design</option>
                    <option value="Executive Governance">Executive Governance</option>
                    <option value="FinTech Engineering">FinTech Engineering</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditUserModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingUser}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md disabled:opacity-50 cursor-pointer"
                >
                  {savingUser ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
