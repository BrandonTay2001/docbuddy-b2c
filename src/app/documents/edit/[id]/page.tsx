'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';
import MediaUpload from '@/components/MediaUpload';
import { getUserProfile } from '@/lib/auth';

interface Session {
  id: string;
  name: string;
  age: number;
  transcript: string;
  summary: string;
  examination_results: string;
  final_diagnosis: string;
  final_prescription: string;
  treatment_plan: string;
  doctor_notes: string;
  document_url: string;
  media_urls: string[];
}

export default function EditDocument({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<Session | null>(null);

  // Form state
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [examinationResults, setExaminationResults] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [prescription, setPrescription] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [existingMediaUrls, setExistingMediaUrls] = useState<string[]>([]);
  const [mediaToDelete, setMediaToDelete] = useState<string[]>([]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const user = await getUserProfile();
        if (!user) {
          throw new Error('User not found');
        }

        const response = await fetch(`/api/sessions/${resolvedParams.id}?userId=${user.id}`);
        if (!response.ok) {
          throw new Error('Failed to fetch session');
        }
        const data = await response.json();
        console.log('Fetched session data:', data);
        setSession(data.session);
        
        // Initialize form state
        setTranscript(data.session.transcript || 'No transcript available: this is a manually-added document');
        setSummary(data.session.summary || '');
        setExaminationResults(data.session.examination_results || '');
        setDiagnosis(data.session.final_diagnosis || '');
        setPrescription(data.session.final_prescription || '');
        setTreatmentPlan(data.session.treatment_plan || '');
        setDoctorNotes(data.session.doctor_notes || '');
        setExistingMediaUrls(data.session.media_urls || []);
      } catch (error) {
        console.error('Error fetching session:', error);
        setError('Failed to load session');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSession();
  }, [resolvedParams.id]);

  const handleDeleteExistingMedia = (urlToDelete: string) => {
    // Remove from display and add to delete list
    setExistingMediaUrls(prev => prev.filter(url => url !== urlToDelete));
    setMediaToDelete(prev => [...prev, urlToDelete]);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');

      const user = await getUserProfile();
      if (!user) {
        throw new Error('User not found');
      }

      // Create FormData to handle both text and files
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('sessionId', resolvedParams.id);
      formData.append('transcript', transcript);
      formData.append('summary', summary);
      formData.append('examinationResults', examinationResults);
      formData.append('diagnosis', diagnosis);
      formData.append('prescription', prescription);
      formData.append('treatmentPlan', treatmentPlan);
      formData.append('doctorNotes', doctorNotes);
      
      // Add remaining existing media URLs
      formData.append('existingMediaUrls', JSON.stringify(existingMediaUrls));
      
      // Add URLs to delete
      if (mediaToDelete.length > 0) {
        formData.append('mediaToDelete', JSON.stringify(mediaToDelete));
      }
      
      // Add new media files
      mediaFiles.forEach((file, index) => {
        formData.append(`mediaFile_${index}`, file);
      });

      // Update session in database
      const response = await fetch(`/api/sessions/${resolvedParams.id}`, {
        method: 'PATCH',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to update session');
      }

      const { documentUrl } = await response.json();
      
      // Open the document in a new tab
      window.open(documentUrl, '_blank');
      
      router.push('/documents');
    } catch (error) {
      console.error('Error saving session:', error);
      setError('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen p-6 md:p-12">
        <div className="max-w-5xl mx-auto">
          <p>Session not found</p>
          <Link href="/documents">
            <Button variant="secondary" className="mt-4">Back to Documents</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12 pb-4 border-b border-border">
          <h1 className="text-3xl font-bold">Edit Document</h1>
          <div className="flex items-center gap-4">
            <Link href="/documents">
              <Button variant="secondary">Back to Documents</Button>
            </Link>
          </div>
        </header>

        <div className="space-y-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Patient Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="patient-name" className="block text-sm font-medium mb-1">Name</label>
                <p id="patient-name" className="text-gray-700">{session.name}</p>
              </div>
              <div>
                <label htmlFor="patient-age" className="block text-sm font-medium mb-1">Age</label>
                <p id="patient-age" className="text-gray-700">{session.age.toString()}</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Session Details</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="transcript" className="block text-sm font-medium mb-1">Transcript</label>
                <textarea
                  id="transcript"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter the session transcript..."
                />
              </div>

              <div>
                <label htmlFor="summary" className="block text-sm font-medium mb-1">Summary</label>
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter the consultation summary..."
                />
              </div>

              <div>
                <label htmlFor="examination-results" className="block text-sm font-medium mb-1">Examination Results</label>
                <textarea
                  id="examination-results"
                  value={examinationResults}
                  onChange={(e) => setExaminationResults(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter physical examination findings..."
                />
              </div>

              <div>
                <label htmlFor="diagnosis" className="block text-sm font-medium mb-1">Final Diagnosis</label>
                <textarea
                  id="diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter the final diagnosis..."
                />
              </div>

              <div>
                <label htmlFor="prescription" className="block text-sm font-medium mb-1">Management</label>
                <textarea
                  id="prescription"
                  value={prescription}
                  onChange={(e) => setPrescription(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter the management plan..."
                />
              </div>

              <div>
                <label htmlFor="treatment-plan" className="block text-sm font-medium mb-1">Plan</label>
                <textarea
                  id="treatment-plan"
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter follow-up plan, tests, referrals, etc."
                />
              </div>

              <div>
                <label htmlFor="doctor-notes" className="block text-sm font-medium mb-1">Doctor&apos;s Notes</label>
                <textarea
                  id="doctor-notes"
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  className="w-full h-32 p-2 border rounded-md"
                  placeholder="Enter any additional notes..."
                />
              </div>
            </div>
          </div>

          {/* Updated media management section */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Media Attachments</h2>
            <div className="space-y-6">
              
              {/* Existing Media Section */}
              {existingMediaUrls.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3">Current Media</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {existingMediaUrls.map((url, index) => {
                      const fileName = url.split('/').pop() || `Media ${index + 1}`;
                      const isImage = /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(url);
                      const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(url);
                      
                      return (
                        <div key={url} className="relative group">
                          <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden border">
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={url}
                                alt={`Existing media ${index + 1}`}
                                className="w-full h-full object-cover"
                              />
                            ) : isVideo ? (
                              <video
                                src={url}
                                className="w-full h-full object-cover"
                                controls={false}
                                muted
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <div className="text-center">
                                  <div className="text-2xl mb-2">📎</div>
                                  <div className="text-xs px-2">{fileName}</div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Delete button */}
                          <button
                            onClick={() => handleDeleteExistingMedia(url)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete media"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          
                          {/* View/Download link */}
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute bottom-2 right-2 bg-blue-500 text-white rounded px-2 py-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            title="View full size"
                          >
                            View
                          </a>
                          
                          {/* File name overlay */}
                          <div className="absolute bottom-2 left-2 right-16 bg-black/70 text-white text-xs p-1 rounded truncate">
                            {fileName}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Show pending deletions */}
                  {mediaToDelete.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm text-red-800">
                        <strong>{mediaToDelete.length}</strong> media file{mediaToDelete.length !== 1 ? 's' : ''} will be deleted when you save changes.
                      </p>
                    </div>
                  )}
                </div>
              )}
              
              {/* Add New Media Section */}
              <div>
                <h3 className="text-lg font-medium mb-3">Add New Media</h3>
                <div className="p-6 border border-border rounded-md bg-background">
                  <MediaUpload 
                    onMediaChange={setMediaFiles}
                    existingMedia={mediaFiles}
                  />
                </div>
              </div>
              
              {/* Summary */}
              <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
                <p>
                  <strong>Summary:</strong> 
                  {existingMediaUrls.length > 0 && ` ${existingMediaUrls.length} existing media file${existingMediaUrls.length !== 1 ? 's' : ''}`}
                  {existingMediaUrls.length > 0 && mediaFiles.length > 0 && ', '}
                  {mediaFiles.length > 0 && ` ${mediaFiles.length} new media file${mediaFiles.length !== 1 ? 's' : ''} to add`}
                  {mediaToDelete.length > 0 && `, ${mediaToDelete.length} file${mediaToDelete.length !== 1 ? 's' : ''} to delete`}
                  {existingMediaUrls.length === 0 && mediaFiles.length === 0 && mediaToDelete.length === 0 && ' No media files'}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Link href="/documents">
              <Button variant="secondary">Cancel</Button>
            </Link>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}