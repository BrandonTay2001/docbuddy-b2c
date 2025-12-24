'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import Button from '@/components/Button';
import Input from '@/components/Input';
import AudioRecorder from '@/components/AudioRecorder';
import AudioPlayer from '@/components/AudioPlayer';
import MediaUpload from '@/components/MediaUpload';
import { getUserProfile } from '@/lib/auth';
import { languageOptions } from '@/lib/languageOptions';
import { transcribeAudioElevenlabs } from '@/lib/elevenlabs';

interface Draft {
  id: string;
  user_id: string;
  audio_url: string;
  title: string;
  created_at: string;
  updated_at: string;
}

enum Step {
  EDIT = 0,
  RECORD = 1,
  REVIEW = 2,
  COMPLETE = 3
}

export default function DraftPage() {
  const router = useRouter();
  const params = useParams();
  const draftId = params.id as string;
  
  const [draft, setDraft] = useState<Draft | null>(null);
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState<Step>(Step.EDIT);
  
  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [combinedAudioUrl, setCombinedAudioUrl] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<string | null>(null);
  
  // Session data state (matching /session/new)
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [suggestedDiagnosis, setSuggestedDiagnosis] = useState('');
  const [suggestedPrescription, setSuggestedPrescription] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientAge, setPatientAge] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [finalPrescription, setFinalPrescription] = useState('');
  const [examinationResults, setExaminationResults] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]); // New field

  const fetchDraft = useCallback(async () => {
    try {
      const user = await getUserProfile();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`/api/drafts/${draftId}?userId=${user.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch draft');
      }

      const data = await response.json();
      setDraft(data.draft);
      setTitle(data.draft.title || `Draft - ${new Date(data.draft.updated_at).toLocaleString()}`);
    } catch (error) {
      console.error('Error fetching draft:', error);
      setError('Failed to load draft');
    } finally {
      setIsLoading(false);
    }
  }, [draftId]); // Add dependencies for this function


  useEffect(() => {
    setIsMounted(true);
    fetchDraft();
  }, [fetchDraft]);

  const handleTitleSave = async () => {
    if (!draft) return;
    
    try {
      const user = await getUserProfile();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, title }),
      });

      if (!response.ok) throw new Error('Failed to update title');
      
      setDraft(prev => prev ? { ...prev, title } : null);
    } catch (error) {
      console.error('Error updating title:', error);
      setError('Failed to update title');
    }
  };

  const handleContinueRecording = () => {
    setCurrentStep(Step.RECORD);
  };

  const handleStartRecording = () => {
    setIsRecording(true);
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleRecordingComplete = async (newAudioBlob: Blob) => {
    if (!draft) return;
    
    try {
      setIsProcessing(true);
      
      const originalResponse = await fetch(draft.audio_url);
      const originalBlob = await originalResponse.blob();
      
      const combinedBlob = await combineAudioBlobs(originalBlob, newAudioBlob);
      
      const combinedUrl = URL.createObjectURL(combinedBlob);
      setCombinedAudioUrl(combinedUrl);
      
      const user = await getUserProfile();
      if (!user) throw new Error('User not authenticated');

      const base64Audio = await blobToBase64(combinedBlob);
      
      const response = await fetch(`/api/drafts/${draftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          audioBlob: base64Audio,
          isFinal: true
        }),
      });

      if (!response.ok) throw new Error('Failed to update draft');
      
      setCurrentStep(Step.REVIEW);
    } catch (error) {
      console.error('Error combining audio:', error);
      setError('Failed to combine audio recordings');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleProceedWithoutRecording = async () => {
    if (!draft) return;
    
    try {
      setIsProcessing(true);
      
      // Use the existing draft audio directly
      setCombinedAudioUrl(draft.audio_url);
      setCurrentStep(Step.REVIEW);
    } catch (error) {
      console.error('Error proceeding without recording:', error);
      setError('Failed to proceed with existing audio');
    } finally {
      setIsProcessing(false);
    }
  };

  const combineAudioBlobs = async (blob1: Blob, blob2: Blob): Promise<Blob> => {
    const arrayBuffer1 = await blob1.arrayBuffer();
    const arrayBuffer2 = await blob2.arrayBuffer();
    
    const combined = new Uint8Array(arrayBuffer1.byteLength + arrayBuffer2.byteLength);
    combined.set(new Uint8Array(arrayBuffer1), 0);
    combined.set(new Uint8Array(arrayBuffer2), arrayBuffer1.byteLength);
    
    return new Blob([combined], { type: 'audio/mp3' });
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  };

  const processAudio = async () => {
    if (!combinedAudioUrl) return;
    
    setIsProcessing(true);
    setError('');
    
    try {
      const response = await fetch(combinedAudioUrl);
      const audioBlob = await response.blob();
      
      const user = await getUserProfile();
      if (!user) throw new Error('User not authenticated');
      
      const transcriptText = await transcribeAudioElevenlabs(audioBlob, user.id, selectedLanguage);
      setTranscript(transcriptText);
      
      const analysisResponse = await fetch('/api/sessions/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          transcript: transcriptText
        }),
      });
      
      if (!analysisResponse.ok) throw new Error('Failed to analyze transcript');
      
      const { analysis } = await analysisResponse.json();
      
      setSummary(analysis.summary);
      setSuggestedDiagnosis(analysis.suggestedDiagnosis);
      setSuggestedPrescription(analysis.suggestedPrescription);
      setFinalDiagnosis(analysis.suggestedDiagnosis);
      setFinalPrescription(analysis.suggestedPrescription);
      
      setCurrentStep(Step.COMPLETE);
    } catch (error) {
      console.error('Error processing audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'An error occurred while processing the audio. Please try again.';
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = () => {
    try {
      const formattedText = `Patient: ${patientName || "[Name]"}; Age: ${patientAge || "[Age]"}

Patient complaint and medical history:
${summary}

Examination results:
${examinationResults}

Diagnosis:
${finalDiagnosis}

Management:
${finalPrescription}

Plan:
${treatmentPlan}`;
      
      navigator.clipboard.writeText(formattedText);
      
      setCopySuccess(true);
      setTimeout(() => {
        setCopySuccess(false);
      }, 2000);
      
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      setError('Failed to copy to clipboard. Please try again.');
    }
  };

  const handleGenerateDocument = async () => {
    if (!patientName || !patientAge || !finalDiagnosis || !finalPrescription) {
      setError('Please fill out all required fields: name, age, final diagnosis, management');
      return;
    }
    
    try {
      setIsProcessing(true);

      const user = await getUserProfile();
      if (!user) {
        throw new Error('User not found');
      }
      
      // Create FormData to handle both text and files
      const formData = new FormData();
      formData.append('userId', user.id);
      formData.append('patientName', patientName);
      formData.append('patientAge', patientAge);
      formData.append('transcript', transcript);
      formData.append('summary', summary);
      formData.append('suggestedDiagnosis', suggestedDiagnosis);
      formData.append('suggestedPrescription', suggestedPrescription);
      formData.append('finalDiagnosis', finalDiagnosis);
      formData.append('finalPrescription', finalPrescription);
      formData.append('examinationResults', examinationResults);
      formData.append('treatmentPlan', treatmentPlan);
      formData.append('doctorNotes', doctorNotes);
      formData.append('draftId', draftId);
      
      // Add media files
      mediaFiles.forEach((file, index) => {
        formData.append(`mediaFile_${index}`, file);
      });

      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        body: formData, // Use FormData instead of JSON
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to save session data');
      }

      const { documentUrl } = await sessionResponse.json();
      
      if (isMounted && documentUrl) {
        window.open(documentUrl, '_blank');
      }
      
      // Delete the draft after successful completion
      await fetch(`/api/drafts/${draftId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });
      
      router.push('/dashboard');
      
    } catch (error) {
      console.error('Error generating document:', error);
      setError('An error occurred while generating the document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Add age validation function
  const validateAge = (value: string): string => {
    // Remove any non-numeric characters
    const numericValue = value.replace(/[^0-9]/g, '');
    
    // Convert to number and clamp between 0-150
    const age = parseInt(numericValue, 10);
    
    if (isNaN(age)) return '';
    if (age < 0) return '0';
    if (age > 150) return '150';
    
    return age.toString();
  };

  const handleAgeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const validatedAge = validateAge(e.target.value);
    setPatientAge(validatedAge);
  };

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

  if (!draft) {
    return (
      <div className="min-h-screen p-6 md:p-12">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-4">Draft Not Found</h1>
          <Link href="/documents">
            <Button>Back to Documents</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">Edit Draft</h1>
            <Link href="/documents">
              <Button variant="secondary">Back to Documents</Button>
            </Link>
          </div>
        </header>

        {/* Progress steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between w-full mb-2">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= Step.EDIT ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                1
              </div>
              <span className="ml-2 text-sm">Edit</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${currentStep >= Step.RECORD ? 'bg-accent' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= Step.RECORD ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                2
              </div>
              <span className="ml-2 text-sm">Record</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${currentStep >= Step.REVIEW ? 'bg-accent' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= Step.REVIEW ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                3
              </div>
              <span className="ml-2 text-sm">Review</span>
            </div>
            <div className={`flex-1 h-1 mx-4 ${currentStep >= Step.COMPLETE ? 'bg-accent' : 'bg-gray-200'}`} />
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                currentStep >= Step.COMPLETE ? 'bg-accent text-white' : 'bg-gray-200 text-gray-500'
              }`}>
                4
              </div>
              <span className="ml-2 text-sm">Complete</span>
            </div>
          </div>
        </div>

        {isProcessing && (
          <div className="flex justify-center items-center p-12">
            <div className="animate-spin h-8 w-8 border-2 border-accent rounded-full border-t-transparent mr-2" />
            <p>Processing...</p>
          </div>
        )}

        {/* Step 1: Edit Draft */}
        {currentStep === Step.EDIT && !isProcessing && (
          <div className="space-y-6">
            <div className="p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Draft Information</h2>
              
              <div className="mb-4">
                <Input
                  label="Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter a title for this draft"
                  fullWidth
                />
                <div className="flex justify-end mt-2">
                  <Button 
                    variant="secondary" 
                    onClick={handleTitleSave}
                  >
                    Save Title
                  </Button>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">Original Recording</h3>
                <AudioPlayer audioUrl={draft.audio_url} />
              </div>
              
              <div className="text-sm text-gray-500 mb-4">
                <p>Created: {new Date(draft.created_at).toLocaleString()}</p>
                <p>Last updated: {new Date(draft.updated_at).toLocaleString()}</p>
              </div>
              
              <div className="flex justify-end">
                <Button onClick={handleContinueRecording}>
                  Continue
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Continue Recording */}
        {currentStep === Step.RECORD && !isProcessing && (
          <div className="space-y-6">
            <div className="p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Continue Recording</h2>
              <p className="mb-4">
                Record additional content to add to your existing draft.
              </p>
              
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isRecording={isRecording}
                onStartRecording={handleStartRecording}
                onStopRecording={handleStopRecording}
              />
              
              <div className="flex justify-between mt-6">
                <Button 
                  variant="secondary" 
                  onClick={() => setCurrentStep(Step.EDIT)}
                >
                  Back to Edit
                </Button>
                <Button 
                  variant="secondary"
                  onClick={handleProceedWithoutRecording}
                >
                  Proceed Without Further Recording
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review Combined Audio */}
        {currentStep === Step.REVIEW && combinedAudioUrl && !isProcessing && (
          <div className="space-y-6">
            <div className="p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Review Combined Recording</h2>
              
              <div className="mb-6">
                <AudioPlayer audioUrl={combinedAudioUrl} />
              </div>
              
              <div className="mb-6">
                <label htmlFor="language-select" className="block mb-2 text-sm font-medium">
                  Select Majority Language in Recording
                </label>
                <select
                  id="language-select"
                  className="input w-full"
                  value={selectedLanguage === null ? '' : selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value === '' ? null : e.target.value)}
                >
                  {languageOptions.map((option) => (
                    <option 
                      key={option.label} 
                      value={option.value === null ? '' : option.value}
                    >
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex justify-between">
                <Button 
                  variant="secondary" 
                  onClick={() => setCurrentStep(Step.RECORD)}
                >
                  Back to Recording
                </Button>
                <Button onClick={processAudio}>
                  Transcribe & Analyze
                </Button>
              </div>
            </div>
            
            {error && (
              <div className={`mt-4 p-3 text-sm rounded-md ${
                error.includes('Usage limit exceeded') 
                  ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Complete - Full Session Form */}
        {currentStep === Step.COMPLETE && (
          <>
            {combinedAudioUrl && (
              <div className="mb-6 p-6 rounded-md bg-background">
                <h2 className="text-xl font-bold mb-4">Recording</h2>
                <AudioPlayer audioUrl={combinedAudioUrl} />
              </div>
            )}

            <div className="mb-6 relative">
              <div className={`p-6 border border-border rounded-md bg-background ${!showTranscript ? 'blur-sm' : ''}`}>
                <h2 className="text-xl font-bold mb-4">Transcript</h2>
                <div className="p-4 bg-input rounded-md max-h-48 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{transcript}</p>
                </div>  
              </div>
              
              {!showTranscript && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Button
                    variant="secondary"
                    onClick={() => setShowTranscript(true)}
                  >
                    Show Transcript
                  </Button>
                </div>
              )}
            </div>

            <div className="mb-6 p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Patient Information</h2>
              
              <Input
                label="Patient Name"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="John Doe"
                required
                fullWidth
              />
              
              <Input
                label="Patient Age"
                type="number"
                value={patientAge}
                onChange={handleAgeChange}
                placeholder="45"
                min="0"
                max="150"
                required
                fullWidth
              />
            </div>

            <div className="mb-6 p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Patient Complaint & Medical History</h2>
              <div className="mb-2">
                <textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="input w-full min-h-[100px] p-3 whitespace-pre-wrap"
                  placeholder="Edit summary"
                />
              </div>
            </div>
            
            <div className="mb-8 p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">AI Suggestions</h2>
              
              <div className="mb-4">
                <h3 className="font-medium mb-2">Suggested Diagnosis</h3>
                <div className="p-3 bg-input rounded-md max-h-32 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{suggestedDiagnosis}</p>
                </div>
              </div>
              
              <div>
                <h3 className="font-medium mb-2">Suggested Prescription</h3>
                <div className="p-3 bg-input rounded-md max-h-32 overflow-y-auto">
                  <p className="whitespace-pre-wrap">{suggestedPrescription}</p>
                </div>
              </div>
            </div>
            
            <div className="mb-4 p-6 border border-border rounded-md bg-background">
              <h2 className="text-xl font-bold mb-4">Doctor&apos;s Assessment</h2>
              
              <div className="mb-4">
                <label htmlFor="examination-results" className="block mb-2 text-sm font-medium">
                  Examination Results
                </label>
                <textarea
                  id="examination-results"
                  value={examinationResults}
                  onChange={(e) => setExaminationResults(e.target.value)}
                  className="input w-full min-h-24"
                  placeholder="Enter physical examination results"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="final-diagnosis" className="block mb-2 text-sm font-medium">
                  Final Diagnosis
                </label>
                <textarea
                  id="final-diagnosis"
                  value={finalDiagnosis}
                  onChange={(e) => setFinalDiagnosis(e.target.value)}
                  className="input w-full min-h-24"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="final-prescription" className="block mb-2 text-sm font-medium">
                  Management
                </label>
                <textarea
                  id="final-prescription"
                  value={finalPrescription}
                  onChange={(e) => setFinalPrescription(e.target.value)}
                  className="input w-full min-h-24"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="treatment-plan" className="block mb-2 text-sm font-medium">
                  Plan
                </label>
                <textarea
                  id="treatment-plan"
                  value={treatmentPlan}
                  onChange={(e) => setTreatmentPlan(e.target.value)}
                  className="input w-full min-h-24"
                  placeholder="Enter follow-up plan, tests, referrals, etc."
                />
              </div>
              
              <div>
                <label htmlFor="doctor-notes" className="block mb-2 text-sm font-medium">
                  Additional Notes (Optional)
                </label>
                <textarea
                  id="doctor-notes"
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  className="input w-full min-h-24"
                  placeholder="Add any additional notes or observations"
                />
              </div>
            </div>
            
            <div className="mb-4 p-6 border border-border rounded-md bg-background">
              <MediaUpload 
                onMediaChange={setMediaFiles}
                existingMedia={mediaFiles}
              />
            </div>
            
            {error && (
              <div className="mb-4 p-3 text-sm bg-red-100 text-red-800 rounded-md">
                {error}
              </div>
            )}
            
            {copySuccess && (
              <div className="mb-4 p-3 text-sm bg-green-100 text-green-800 rounded-md">
                Copied to clipboard!
              </div>
            )}
            
            <div className="flex justify-between gap-4">
              <Button 
                variant="secondary"
                onClick={copyToClipboard}
                disabled={isProcessing}
              >
                Copy to Clipboard
              </Button>
              <Button 
                onClick={handleGenerateDocument}
                disabled={isProcessing}
              >
                Generate Document
              </Button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
