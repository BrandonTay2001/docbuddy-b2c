import { ElevenLabsClient } from "elevenlabs";

const client = new ElevenLabsClient({ apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || '' });

interface SpeakerSegment {
    speaker_id: string,
    speech: string
}

async function getCurrentMonthUsage(userId: string): Promise<number> {
    try {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1;
        
        const response = await fetch(`/api/usage?userId=${userId}&year=${year}&month=${month}`);
        
        if (!response.ok) {
            return 0; // If we can't get usage, assume 0 to be safe
        }
        
        const data = await response.json();
        const usage = data.usage[0]?.minutes_used || 0;
        // Ensure we return a number, not a string
        return Number(usage);
    } catch (error) {
        console.error('Error fetching current usage:', error);
        return 0; // If we can't get usage, assume 0 to be safe
    }
}

function estimateAudioDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve) => {
        const audio = document.createElement('audio');
        const url = URL.createObjectURL(audioBlob);
        
        audio.addEventListener('loadedmetadata', () => {
            const durationInMinutes = audio.duration / 60;
            URL.revokeObjectURL(url);
            resolve(durationInMinutes);
        });
        
        audio.addEventListener('error', () => {
            URL.revokeObjectURL(url);
            // If we can't determine duration, estimate based on file size
            // Rough estimate: 1MB ≈ 1 minute for typical voice recordings
            const estimatedMinutes = audioBlob.size / (1024 * 1024);
            resolve(estimatedMinutes);
        });
        
        audio.src = url;
    });
}

async function updateTranscriptionUsage(userId: string, minutes: number) {
    try {
        const response = await fetch('/api/transcription/usage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, minutes }),
        });

        if (!response.ok) {
            throw new Error('Failed to update usage');
        }
    } catch (error) {
        console.error('Error updating transcription usage:', error);
        // Don't throw the error as we don't want to fail the transcription if usage tracking fails
    }
}

export async function transcribeAudioElevenlabs(audioBlob: Blob, userId: string, languageCode: string | null = null): Promise<string> {
    // Check current usage before processing
    const currentUsage = await getCurrentMonthUsage(userId);
    const estimatedDuration = await estimateAudioDuration(audioBlob);
    
    // Ensure both values are numbers
    const currentUsageNum = Number(currentUsage);
    const estimatedDurationNum = Number(estimatedDuration);
    const totalUsage = currentUsageNum + estimatedDurationNum;
    
    const USAGE_LIMIT = 120; // 120 minutes limit for DocBuddy Alpha
    
    if (totalUsage > USAGE_LIMIT) {
        throw new Error(
            `Usage limit exceeded. You have used ${currentUsageNum.toFixed(1)} minutes this month, ` +
            `exceeding the 120-minute limit for DocBuddy Alpha.`
        );
    }
    
    const file = new File([audioBlob], "recording.mp3", { type: "audio/mp3" });
    const options = {
        file: file,
        model_id: "scribe_v1",
        diarize: true,
        ...(languageCode && { language_code: languageCode })
    };
    
    const transcription = await client.speechToText.convert(options);

    // Calculate actual duration in minutes and update usage
    if (transcription.words && transcription.words.length > 0) {
        const lastWord = transcription.words[transcription.words.length - 1];
        const actualDurationInSeconds = lastWord.end || 0;
        const actualDurationInMinutes = actualDurationInSeconds / 60;
        
        // Update usage tracking with actual duration
        await updateTranscriptionUsage(userId, actualDurationInMinutes);
    } else {
        // Fallback to estimated duration if no timing info available
        await updateTranscriptionUsage(userId, estimatedDuration);
    }

    const segments: SpeakerSegment[] = [];
    let currentSpeaker = transcription.words[0]?.speaker_id || '';
    let currentSpeech = '';
    
    for (const word of transcription.words) {
        if (word.type === 'spacing') continue;

        // If speaker changed, push current segment and start new one
        if (currentSpeaker !== word.speaker_id) {
            if (currentSpeaker !== null && currentSpeech.trim().length > 0) {
                segments.push({
                    speaker_id: currentSpeaker,
                    speech: currentSpeech.trim()
                });
            }
            currentSpeaker = word.speaker_id || '';
            currentSpeech = word.text;
        } else {
            // Add space between words of the same speaker
            if (currentSpeech.length > 0) {
                currentSpeech += ' ';
            }
            currentSpeech += word.text;
        }
    }
    
    // Add the last segment if there's content
    if (currentSpeech.trim().length > 0) {
        segments.push({
            speaker_id: currentSpeaker,
            speech: currentSpeech.trim()
        });
    }

    // Convert segments to a formatted string
    const formattedTranscript = segments.map(segment => 
        `Speaker ${segment.speaker_id}: ${segment.speech}`
    ).join('\n\n');
    
    
    return formattedTranscript;
}