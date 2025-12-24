import { useState, useEffect, useRef } from 'react';
import Button from './Button';

// Import type (only for TypeScript)
import type MicRecorderType from 'mic-recorder-to-mp3';

interface AudioRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onPauseRecording?: (blob: Blob) => void;
  onResumeRecording?: () => void;
}

const AudioRecorder = ({
  onRecordingComplete,
  isRecording,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
}: AudioRecorderProps) => {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isMounted, setIsMounted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const recorderRef = useRef<MicRecorderType | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Set mounted state and initialize recorder
  useEffect(() => {
    setIsMounted(true);
    
    if (typeof window !== 'undefined') {
      // Import and initialize the recorder only on client side
      import('mic-recorder-to-mp3').then((MicRecorderModule) => {
        const MicRecorder = MicRecorderModule.default;
        try {
          recorderRef.current = new MicRecorder({ 
            bitRate: 128,
            prefix: 'data:audio/mp3;base64,',
          });
        } catch (error) {
          console.error('Error initializing recorder:', error);
        }
      }).catch(error => {
        console.error("Failed to load mic-recorder module:", error);
      });
    } else {
    }
    
    return () => {
      setIsMounted(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (!isMounted) return;

    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (!isRecording) {
        setRecordingTime(0);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, isPaused, isMounted]);

  // Handle starting the recording
  const handleStart = () => {
    if (!recorderRef.current) {
      console.error('recorderRef.current is null');
      return;
    }
    
    try {
      recorderRef.current.start()
        .then(() => {
          onStartRecording();
          setIsPaused(false);
          audioChunksRef.current = [];
        })
        .catch((error: Error) => {
          console.error('Error starting recording:', error);
        });
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  };
  
  // Handle stopping the recording
  const handleStop = () => {
    if (!recorderRef.current) {
      console.error('recorderRef.current is null');
      return;
    }
    
    try {
      recorderRef.current.stop()
        .getMp3()
        .then(([, blob]: [ArrayBuffer, Blob]) => {
          // Add the final chunk to our collection
          audioChunksRef.current.push(blob);
          
          // Combine all audio chunks into a single blob
          const combinedBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
          
          // Use the combined blob
          onRecordingComplete(combinedBlob);
          onStopRecording();
          setIsPaused(false);
          audioChunksRef.current = [];
        })
        .catch((error: Error) => {
          console.error('Error stopping recording:', error);
          onStopRecording();
          setIsPaused(false);
          audioChunksRef.current = [];
        });
    } catch (error) {
      console.error('Failed to stop recording:', error);
      onStopRecording();
      setIsPaused(false);
      audioChunksRef.current = [];
    }
  };

  // Handle pausing the recording
  const handlePause = async () => {
    if (!recorderRef.current) {
      console.error('recorderRef.current is null');
      return;
    }
    
    try {
      // First stop the current recording segment
      const stopResult = await recorderRef.current.stop().getMp3();
      const blob = stopResult[1]; // Get the blob from the result
      
      
      // Add the current chunk to our collection
      audioChunksRef.current.push(blob);
      
      // Set paused state in UI
      setIsPaused(true);
      
      // Combine all chunks and send to parent for saving
      const combinedBlob = new Blob(audioChunksRef.current, { type: 'audio/mp3' });
      
      // Call parent handler but don't clear chunks since we'll continue recording
      if (onPauseRecording) {
        await onPauseRecording(combinedBlob);
      }
    } catch (error) {
      console.error('Failed to pause recording:', error);
    }
  };

  // Handle resuming the recording
  const handleResume = () => {
    if (!recorderRef.current) {
      console.error('recorderRef.current is null');
      return;
    }
    
    try {
      recorderRef.current.start()
        .then(() => {
          setIsPaused(false);
          if (onResumeRecording) {
            onResumeRecording();
          }
        })
        .catch((error: Error) => {
          console.error('Error resuming recording:', error);
        });
    } catch (error) {
      console.error('Failed to resume recording:', error);
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="w-full p-6 border border-border rounded-md bg-background shadow-sm">
        <div className="flex justify-between items-center mb-4">
          <h3>Record Live</h3>
          {isRecording && isMounted && (
            <div className="flex items-center">
              <div className={`h-3 w-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'} mr-2`} />
              <span className="text-sm font-mono">{formatTime(recordingTime)}</span>
            </div>
          )}
        </div>
        
        <div className="flex justify-center gap-4 mb-4">
          {isRecording ? (
            <>
              {isPaused ? (
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    handleResume();
                  }}
                  className="flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11v11.78a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                  Resume
                </Button>
              ) : (
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    handlePause();
                  }}
                  className="flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path d="M5.75 3a.75.75 0 01.75.75v11.5a.75.75 0 01-1.5 0V3.75A.75.75 0 015.75 3zm5.75.75a.75.75 0 00-1.5 0v11.5a.75.75 0 001.5 0V3.75z" />
                  </svg>
                  Pause
                </Button>
              )}
              <Button 
                variant="secondary" 
                onClick={() => {
                  handleStop();
                }}
                className="flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                  <rect x="6" y="6" width="8" height="8" />
                </svg>
                End Session
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => {
                handleStart();
              }}
              className="flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="10" cy="10" r="5" />
              </svg>
              Start Session
            </Button>
          )}
        </div>
        
        {isRecording && (
          <p className="text-sm text-center text-gray-500">
            {isPaused 
              ? "Recording paused. Click 'Resume' to continue or 'End Session' to finish."
              : "Recording patient session. Click 'Pause' to pause or 'End Session' when you're done."}
          </p>
        )}
      </div>
    </div>
  );
};

export default AudioRecorder;