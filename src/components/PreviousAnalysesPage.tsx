import { useEffect, useState } from 'react';
import { Calendar, TrendingUp, Trash2, Eye, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Snapshot {
  id: string;
  created_at: string;
  business_cycle: string;
  economic_cycle: string;
  global_liquidity: string;
  macro_outlook: string;
}

interface Props {
  onLoadSnapshot: (snapshotId: string) => void;
  onNewAnalysis: () => void;
}

export default function PreviousAnalysesPage({ onLoadSnapshot, onNewAnalysis }: Props) {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadSnapshots();
  }, []);

  const loadSnapshots = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('macro_snapshots')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSnapshots(data || []);
    } catch (error) {
      console.error('Error loading snapshots:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    if (!confirm('Are you sure you want to delete this analysis? This cannot be undone.')) {
      return;
    }

    setDeleting(snapshotId);
    try {
      const { error } = await supabase
        .from('macro_snapshots')
        .delete()
        .eq('id', snapshotId);

      if (error) throw error;

      setSnapshots(snapshots.filter(s => s.id !== snapshotId));
    } catch (error) {
      console.error('Error deleting snapshot:', error);
      alert('Failed to delete analysis');
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading previous analyses...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Previous Analyses</h1>
            <p className="text-slate-600">View and manage your macro economic analysis history</p>
          </div>
          <button
            onClick={onNewAnalysis}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
          >
            New Analysis
          </button>
        </div>

        {snapshots.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 mb-2">No Previous Analyses</h3>
            <p className="text-slate-600 mb-6">Start your first macro economic analysis</p>
            <button
              onClick={onNewAnalysis}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold"
            >
              Create New Analysis
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          {new Date(snapshot.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                        <p className="text-sm text-slate-500">
                          {new Date(snapshot.created_at).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Business Cycle:</span>
                      <span className="font-medium text-slate-900 capitalize">{snapshot.business_cycle}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-sm text-slate-600">Global Liquidity:</span>
                      <span className="font-medium text-slate-900 capitalize">{snapshot.global_liquidity}</span>
                    </div>
                    <div className="py-2">
                      <p className="text-sm text-slate-600 mb-1">Outlook:</p>
                      <p className="text-sm text-slate-800 line-clamp-2">{snapshot.macro_outlook}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => onLoadSnapshot(snapshot.id)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Analysis
                    </button>
                    <button
                      onClick={() => handleDelete(snapshot.id)}
                      disabled={deleting === snapshot.id}
                      className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                    >
                      {deleting === snapshot.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
