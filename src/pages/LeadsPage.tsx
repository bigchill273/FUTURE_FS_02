import { useMemo, useState } from 'react';
import {
  Download,
  LayoutGrid,
  List,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  Lead,
  LeadSource,
  LeadStatus,
} from '../types/crm';
import { useCrm } from '../context/CrmContext';
import {
  filterAndSortLeads,
  formatCurrency,
  formatDateShort,
  leadsToCsv,
} from '../utils/crmLogic';
import { PriorityText, StatusLabel } from '../components/StatusLabel';

interface LeadsPageProps {
  onSelectLead: (lead: Lead) => void;
  onEditLead: (lead: Lead) => void;
  onNewLead: () => void;
}

export function LeadsPage({
  onSelectLead,
  onEditLead,
  onNewLead,
}: LeadsPageProps) {
  const { leads, loading, error, updateLead, deleteLead } = useCrm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<LeadSource | 'all'>('all');
  const [sortBy, setSortBy] = useState<
    'createdAt' | 'updatedAt' | 'value' | 'name'
  >('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  const filteredLeads = useMemo(
    () =>
      filterAndSortLeads(leads, {
        search,
        status: statusFilter,
        source: sourceFilter,
        sortBy,
        sortDir,
      }),
    [leads, search, statusFilter, sourceFilter, sortBy, sortDir]
  );

  const handleExportCsv = () => {
    const csv = leadsToCsv(filteredLeads);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-export-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSortHeader = (
    field: 'createdAt' | 'updatedAt' | 'value' | 'name'
  ) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'name' ? 'asc' : 'desc');
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
        <div className="h-64 bg-slate-50 rounded-lg animate-pulse" />
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

  return (
    <div className="space-y-5">
      {/* Filter & Action Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search leads"
              placeholder="Search name, email, company, source..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <select
              aria-label="Filter by source"
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as LeadSource | 'all')
              }
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="all">All Sources</option>
              {LEAD_SOURCES.map((source) => (
                <option key={source} value={source}>
                  {source}
                </option>
              ))}
            </select>

            <select
              aria-label="Sort leads"
              value={`${sortBy}:${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split(':') as [
                  'createdAt' | 'updatedAt' | 'value' | 'name',
                  'asc' | 'desc',
                ];
                setSortBy(field);
                setSortDir(dir);
              }}
              className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg bg-white text-slate-700"
            >
              <option value="createdAt:desc">Newest First</option>
              <option value="updatedAt:desc">Recently Updated</option>
              <option value="value:desc">Highest Value</option>
              <option value="name:asc">Name (A–Z)</option>
            </select>

            <div
              className="flex items-center p-1 bg-slate-100 rounded-lg"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Table view"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label="Card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredLeads.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-50 rounded-lg whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Status Segmented Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({leads.length})
          </button>
          {LEAD_STATUSES.map((s) => {
            const count = leads.filter((l) => l.status === s.value).length;
            return (
              <button
                key={s.value}
                type="button"
                onClick={() => setStatusFilter(s.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === s.value
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Results View */}
      {filteredLeads.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <h2 className="font-display text-base font-semibold text-slate-900">
            No matching leads
          </h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            {leads.length === 0
              ? 'Add your first lead manually or share the Public Contact Form to capture website inquiries.'
              : 'Try clearing your search query or switching status and source filters.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            {leads.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                  setSourceFilter('all');
                }}
                className="px-4 py-2 text-xs font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Reset Filters
              </button>
            )}
            <button
              type="button"
              onClick={onNewLead}
              className="px-4 py-2 text-xs font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg"
            >
              Add Lead
            </button>
          </div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('name')}
                      className="hover:text-slate-900 font-medium"
                    >
                      Lead / Company
                    </button>
                  </th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Source</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('value')}
                      className="hover:text-slate-900 font-medium"
                    >
                      Deal Value
                    </button>
                  </th>
                  <th className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => handleSortHeader('createdAt')}
                      className="hover:text-slate-900 font-medium"
                    >
                      Added
                    </button>
                  </th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => onSelectLead(lead)}
                        className="text-left group"
                      >
                        <div className="font-medium text-slate-900 group-hover:text-blue-700">
                          {lead.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          {lead.company || 'Independent'}
                        </div>
                      </button>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-xs text-slate-800">{lead.email}</div>
                      {lead.phone && (
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {lead.phone}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {lead.source}
                    </td>
                    <td className="py-3 px-4">
                      <select
                        aria-label={`Change status for ${lead.name}`}
                        value={lead.status}
                        onChange={(e) =>
                          updateLead(lead.id, {
                            status: e.target.value as LeadStatus,
                          })
                        }
                        className="px-2 py-1 text-xs font-medium border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {LEAD_STATUSES.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {formatCurrency(lead.value)}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap">
                      {formatDateShort(lead.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onSelectLead(lead)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 rounded-md"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditLead(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                          aria-label={`Edit ${lead.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteLead(lead.id)}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md"
                          aria-label={`Delete ${lead.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => (
            <article
              key={lead.id}
              className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectLead(lead)}
                    className="text-left min-w-0"
                  >
                    <h3 className="font-display text-base font-semibold text-slate-900 hover:text-blue-700 truncate">
                      {lead.name}
                    </h3>
                    <div className="text-xs text-slate-500 truncate">
                      {lead.company || 'Independent'}
                    </div>
                  </button>
                  <StatusLabel status={lead.status} />
                </div>

                <div className="text-xs text-slate-600 space-y-1 pt-1">
                  <div className="truncate">{lead.email}</div>
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span>{lead.source}</span>
                    <span aria-hidden="true">·</span>
                    <PriorityText priority={lead.priority} />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold tabular-nums text-slate-900">
                    {formatCurrency(lead.value)}
                  </div>
                  <div className="font-mono text-xs tabular-nums text-slate-400">
                    {formatDateShort(lead.createdAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectLead(lead)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Open Lead
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
