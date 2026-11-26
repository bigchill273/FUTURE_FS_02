import React, { useState } from 'react';
import { LEAD_STATUSES, Lead, LeadStatus } from '../types/crm';
import { useCrm } from '../context/CrmContext';
import { formatCurrency } from '../utils/crmLogic';
import { PriorityText } from '../components/StatusLabel';

interface PipelinePageProps {
  onSelectLead: (lead: Lead) => void;
}

export function PipelinePage({ onSelectLead }: PipelinePageProps) {
  const { leads, loading, error, updateLead } = useCrm();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);

  if (loading && leads.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="h-80 bg-white border border-slate-200 rounded-xl animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white border border-red-200 rounded-xl text-sm text-red-700">
        {error}
      </div>
    );
  }

  const handleDrop = async (e: React.DragEvent, targetStatus: LeadStatus) => {
    e.preventDefault();
    const id = draggedLeadId || e.dataTransfer.getData('text/plain');
    setDropTarget(null);
    setDraggedLeadId(null);
    if (!id) return;
    const current = leads.find((l) => l.id === id);
    if (!current || current.status === targetStatus) return;
    await updateLead(id, { status: targetStatus });
  };

  return (
    <div className="space-y-4">
      <div className="text-xs text-slate-500">
        Drag deal cards between stages or use the stage selector on any card to
        update pipeline progression.
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 items-start">
        {LEAD_STATUSES.map((stage) => {
          const stageLeads = leads.filter((l) => l.status === stage.value);
          const stageValue = stageLeads.reduce((sum, l) => sum + l.value, 0);
          const isOver = dropTarget === stage.value;

          return (
            <section
              key={stage.value}
              aria-label={`${stage.label} stage`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(stage.value);
              }}
              onDragLeave={() => setDropTarget(null)}
              onDrop={(e) => handleDrop(e, stage.value)}
              className={`w-72 shrink-0 rounded-xl border p-3.5 transition-colors ${
                isOver
                  ? 'bg-blue-50/70 border-blue-400'
                  : 'bg-slate-100/70 border-slate-200'
              }`}
            >
              <div className="pb-3 mb-3 border-b border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-sm font-semibold text-slate-900">
                    {stage.label}
                  </h2>
                  <div className="font-mono text-xs tabular-nums text-slate-500">
                    {formatCurrency(stageValue)}
                  </div>
                </div>
                <span className="font-mono text-xs font-medium tabular-nums text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                  {stageLeads.length}
                </span>
              </div>

              <div className="space-y-2.5 min-h-[160px]">
                {stageLeads.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    No deals in {stage.label}
                  </div>
                ) : (
                  stageLeads.map((lead) => (
                    <article
                      key={lead.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedLeadId(lead.id);
                        e.dataTransfer.setData('text/plain', lead.id);
                      }}
                      onDragEnd={() => {
                        setDraggedLeadId(null);
                        setDropTarget(null);
                      }}
                      className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-2.5 cursor-grab active:cursor-grabbing hover:border-slate-300 transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="w-full text-left"
                      >
                        <div className="text-sm font-semibold text-slate-900 hover:text-blue-700 truncate">
                          {lead.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {lead.company || lead.email}
                        </div>
                      </button>

                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono font-semibold tabular-nums text-slate-900">
                          {formatCurrency(lead.value)}
                        </span>
                        <PriorityText priority={lead.priority} />
                      </div>

                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                        <span className="text-xs text-slate-500 truncate">
                          {lead.source}
                        </span>
                        <select
                          aria-label={`Move ${lead.name} to stage`}
                          value={lead.status}
                          onChange={(e) =>
                            updateLead(lead.id, {
                              status: e.target.value as LeadStatus,
                            })
                          }
                          className="px-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 text-slate-700"
                        >
                          {LEAD_STATUSES.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
