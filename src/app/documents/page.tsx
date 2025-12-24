'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Button from '@/components/Button';
import { getUserProfile } from '@/lib/auth';

interface Session {
  id: string;
  name: string;
  created_at: string;
  document_url: string;
}

interface Draft {
  id: string;
  title: string;
  user_id: string;
  audio_url: string;
  created_at: string;
  updated_at: string;
}

interface UserProfile {
  id: string;
  // Add other user properties as needed
}

// Define tab types
type TabType = 'complete' | 'drafts';

export default function Documents() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  // Default to showing complete documents
  const [activeTab, setActiveTab] = useState<TabType>('complete');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const fetchData = async () => {
      try {
        const userProfile = await getUserProfile();
        if (!userProfile) {
          throw new Error('User not found');
        }
        setUser(userProfile);

        // Fetch user sessions
        const sessionsResponse = await fetch(`/api/sessions?userId=${userProfile.id}`);
        if (!sessionsResponse.ok) {
          throw new Error('Failed to fetch sessions');
        }
        const sessionsData = await sessionsResponse.json();
        setSessions(sessionsData.sessions);
        
        // Fetch user drafts
        const draftsResponse = await fetch(`/api/drafts?userId=${userProfile.id}`);
        if (!draftsResponse.ok) {
          throw new Error('Failed to fetch drafts');
        }
        const draftsData = await draftsResponse.json();
        setDrafts(draftsData.drafts);
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Delete session function
  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
      return;
    }

    if (!user) {
      alert('User not found. Please refresh the page.');
      return;
    }

    setDeletingId(sessionId);
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      setSessions(sessions.filter(session => session.id !== sessionId));
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Delete draft function
  const deleteDraft = async (draftId: string) => {
    if (!confirm('Are you sure you want to delete this draft? This action cannot be undone.')) {
      return;
    }

    if (!user) {
      alert('User not found. Please refresh the page.');
      return;
    }

    setDeletingId(draftId);
    try {
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete draft');
      }

      setDrafts(drafts.filter(draft => draft.id !== draftId));
    } catch (error) {
      console.error('Error deleting draft:', error);
      alert('Failed to delete draft. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // Format date for display
  const formatDateTime = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return new Date(dateString).toLocaleString(undefined, options);
  };

  // Show a simple loading state during SSR
  if (!isMounted) {
    return <div className="min-h-screen" />;
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-8 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold">Patient Documents</h1>
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="secondary">Back to Dashboard</Button>
            </Link>
          </div>
        </header>

        <div className="mb-8">
          <div className="flex justify-between mb-8">
            <div className="flex gap-4">
              <Link href="/documents/new">
                <Button>Create New Document</Button>
              </Link>
              <Link href="/session/new">
                <Button variant="secondary">Start New Session</Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* Tab navigation */}
        <div className="mb-6 border-b border-border">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('complete')}
              className={`py-2 px-1 font-medium text-lg relative ${
                activeTab === 'complete' 
                  ? 'text-accent' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Complete Documents
              {activeTab === 'complete' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`py-2 px-1 font-medium text-lg relative ${
                activeTab === 'drafts' 
                  ? 'text-accent' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Drafts
              {drafts.length > 0 && (
                <span className="ml-2 py-0.5 px-2 text-xs rounded-full bg-accent text-white">
                  {drafts.length}
                </span>
              )}
              {activeTab === 'drafts' && (
                <span className="absolute bottom-0 left-0 w-full h-0.5 bg-accent"></span>
              )}
            </button>
          </div>
        </div>
        
        {/* Drafts View */}
        {activeTab === 'drafts' && (
          <>
            {drafts.length > 0 ? (
              <div className="space-y-4">
                {drafts.map((draft) => (
                  <div 
                    key={draft.id}
                    className="p-4 border border-border rounded-md bg-background hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <Link 
                        href={`/documents/drafts/${draft.id}`}
                        className="flex-1 hover:underline"
                      >
                        <div>
                          <h3 className="text-lg font-semibold">
                            {draft.title || `Draft - ${formatDateTime(draft.updated_at)}`}
                          </h3>
                          <p className="text-sm text-gray-500">
                            Created: {formatDateTime(draft.created_at)}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            deleteDraft(draft.id);
                          }}
                          disabled={deletingId === draft.id}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete draft"
                        >
                          {deletingId === draft.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-red-500 rounded-full border-t-transparent" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 border border-border rounded-md bg-background text-center">
                <p className="text-gray-500">No draft recordings found</p>
              </div>
            )}
          </>
        )}
        
        {/* Complete Documents View */}
        {activeTab === 'complete' && (
          <>
            {sessions.length > 0 ? (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="p-4 border border-border rounded-md bg-background hover:bg-accent/5 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <Link href={`/documents/edit/${session.id}`} className="hover:underline flex-1">
                        <div>
                          <h3 className="text-lg font-semibold">{session.name}</h3>
                          <p className="text-sm text-gray-500">
                            {new Date(session.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </Link>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            window.open(session.document_url, '_blank');
                          }}
                        >
                          View Report
                        </Button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            deleteSession(session.id);
                          }}
                          disabled={deletingId === session.id}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50"
                          title="Delete document"
                        >
                          {deletingId === session.id ? (
                            <div className="animate-spin h-4 w-4 border-2 border-red-500 rounded-full border-t-transparent" />
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 border border-border rounded-md bg-background text-center">
                <h3 className="text-xl font-bold mb-4">No Documents Found</h3>
                <p className="text-gray-500 mb-6">
                  You haven&apos;t created any documents yet. Use the buttons above to create documents manually or start a new recording session.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}