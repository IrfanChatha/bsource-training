"use client";
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { supabaseService } from '../lib/services/supabaseService';
import { GraduationCap, ArrowRight, Calendar, Clock, MapPin } from 'lucide-react';

/**
 * `/trainer/attendance` and `/trainer/quiz` used to have no `[id]` segment, so
 * they always fell back to a hardcoded training that does not exist. They now
 * land here when no training is given, and link on to the real per-training
 * screen.
 */
export function TrainingPicker({ title, description, hrefPrefix, icon }) {
  const { navigate, showToast } = useApp();
  const [trainings, setTrainings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabaseService
      .getTrainings()
      .then((rows) => {
        if (!active) return;
        setTrainings(rows || []);
      })
      .catch((e) => showToast(e?.message || 'Could not load trainings', 'error'))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [showToast]);

  if (loading) {
    return <div className="p-12 text-center text-slate-400 text-sm">Loading training sessions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">{description}</p>
      </div>

      {trainings.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 space-y-3">
          <GraduationCap className="w-10 h-10 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            No training sessions yet
          </p>
          <button
            onClick={() => navigate('/trainer/trainings')}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white cursor-pointer"
          >
            Create your first session
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {trainings.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`${hrefPrefix}/${t.id}`)}
              className="text-left p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-800 transition-all cursor-pointer space-y-3 group"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-md tracking-wider ${
                      t.status === 'in_progress'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {t.status === 'in_progress' ? '● Live Session' : t.status}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t.title}
                  </h3>
                </div>
                <span className="text-indigo-500 shrink-0">{icon || <ArrowRight className="w-4 h-4" />}</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {t.date}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {t.time}
                </span>
                <span className="flex items-center gap-1.5 col-span-2 sm:col-span-1 truncate">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{t.location || 'Online'}</span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default TrainingPicker;
