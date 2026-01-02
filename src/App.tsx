import { useEffect, useState } from 'react';
import { supabase } from './lib/supabase';
import AuthPage from './components/AuthPage';
import QuestionnairePage from './components/QuestionnairePage';
import DashboardPage from './components/DashboardPage';
import RecommendationsPage from './components/RecommendationsPage';
import AITransparencyPage from './components/AITransparencyPage';
import OptionsStrategyPage from './components/OptionsStrategyPage';
import PreviousAnalysesPage from './components/PreviousAnalysesPage';
import AssetDataPage from './components/AssetDataPage';
import PortfolioPage from './components/PortfolioPage';
import { LogOut, History } from 'lucide-react';

type Page = 'questionnaire' | 'dashboard' | 'recommendations' | 'transparency' | 'assetdata' | 'portfolio' | 'options' | 'previous';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<Page>('questionnaire');
  const [currentSnapshotId, setCurrentSnapshotId] = useState<string>('');

  useEffect(() => {
    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setCurrentPage('questionnaire');
    setCurrentSnapshotId('');
  };

  const handleQuestionnaireComplete = (snapshotId: string) => {
    setCurrentSnapshotId(snapshotId);
    setCurrentPage('dashboard');
  };

  const handleAnalyze = () => {
    setCurrentPage('recommendations');
  };

  const handleContinueToTransparency = () => {
    setCurrentPage('transparency');
  };

  const handleContinueToAssetData = () => {
    setCurrentPage('assetdata');
  };

  const handleAssetDataComplete = () => {
    setCurrentPage('portfolio');
  };

  const handleContinueToOptions = () => {
    setCurrentPage('options');
  };

  const handleGoHome = () => {
    setCurrentPage('questionnaire');
    setCurrentSnapshotId('');
  };

  const handleLoadSnapshot = (snapshotId: string) => {
    setCurrentSnapshotId(snapshotId);
    setCurrentPage('dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage onAuth={checkUser} />;
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold text-slate-900">MacroTrader</h1>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleGoHome}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === 'questionnaire'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  New Analysis
                </button>
                <button
                  onClick={() => setCurrentPage('previous')}
                  className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    currentPage === 'previous'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <History className="w-4 h-4" />
                  Previous
                </button>
                {currentSnapshotId && (
                  <>
                    <button
                      onClick={() => setCurrentPage('dashboard')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 'dashboard'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Dashboard
                    </button>
                    <button
                      onClick={() => setCurrentPage('recommendations')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 'recommendations'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Analysis
                    </button>
                    <button
                      onClick={() => setCurrentPage('transparency')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 'transparency'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      AI Logic
                    </button>
                    <button
                      onClick={() => setCurrentPage('assetdata')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 'assetdata'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Asset Data
                    </button>
                    <button
                      onClick={() => setCurrentPage('portfolio')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        currentPage === 'portfolio'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      Portfolio
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main>
        {currentPage === 'questionnaire' && (
          <QuestionnairePage onComplete={handleQuestionnaireComplete} />
        )}
        {currentPage === 'previous' && (
          <PreviousAnalysesPage
            onLoadSnapshot={handleLoadSnapshot}
            onNewAnalysis={handleGoHome}
          />
        )}
        {currentPage === 'dashboard' && currentSnapshotId && (
          <DashboardPage snapshotId={currentSnapshotId} onAnalyze={handleAnalyze} />
        )}
        {currentPage === 'recommendations' && currentSnapshotId && (
          <RecommendationsPage snapshotId={currentSnapshotId} onContinue={handleContinueToTransparency} />
        )}
        {currentPage === 'transparency' && currentSnapshotId && (
          <AITransparencyPage snapshotId={currentSnapshotId} onContinue={handleContinueToAssetData} />
        )}
        {currentPage === 'assetdata' && currentSnapshotId && (
          <AssetDataPage
            snapshotId={currentSnapshotId}
            onBack={() => setCurrentPage('transparency')}
            onComplete={handleAssetDataComplete}
          />
        )}
        {currentPage === 'portfolio' && currentSnapshotId && (
          <PortfolioPage
            snapshotId={currentSnapshotId}
            onBack={() => setCurrentPage('assetdata')}
          />
        )}
        {currentPage === 'options' && currentSnapshotId && (
          <OptionsStrategyPage snapshotId={currentSnapshotId} />
        )}
      </main>
    </div>
  );
}

export default App;
