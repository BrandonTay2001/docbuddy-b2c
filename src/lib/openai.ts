import OpenAI from 'openai';

// Initialize the OpenAI client
const openai = new OpenAI({
  baseURL: "https://api.deepseek.com",
  apiKey: process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

async function generateSummary(transcript: string, summaryPrompt: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: summaryPrompt
        },
        {
          role: "user",
          content: transcript
        }
      ],
    });

    const response = completion.choices[0].message.content || '';
    return response.trim();
  } catch (error) {
    console.error('Error generating summary:', error);
    throw error;
  }
}

async function generateDiagnosisAndPrescription(
  transcript: string, 
  clinicPrompt: string
): Promise<{ diagnosis: string; prescription: string }> {
  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `${clinicPrompt}\n\nPlease provide the diagnosis and prescription in the following format:\nDiagnosis: <diagnosis>\nPrescription: <prescription>`
        },
        {
          role: "user",
          content: transcript
        }
      ],
    });

    const response = completion.choices[0].message.content || '';
    
    // Parse the response to extract diagnosis and prescription
    const diagnosisMatch = response.match(/Diagnosis:([\s\S]*?)(?=Prescription:|$)/);
    const prescriptionMatch = response.match(/Prescription:([\s\S]*?)(?=$)/);
    
    return {
      diagnosis: diagnosisMatch ? diagnosisMatch[1].trim() : 'No diagnosis suggestion available',
      prescription: prescriptionMatch ? prescriptionMatch[1].trim() : 'No prescription suggestion available',
    };
  } catch (error) {
    console.error('Error generating diagnosis and prescription:', error);
    throw error;
  }
}

// Function to analyze transcript and generate diagnosis suggestions
export async function analyzeMedicalTranscript(
  transcript: string,
  clinicPrompt: string,
  summaryPrompt: string
): Promise<{ 
  summary: string;
  suggestedDiagnosis: string;
  suggestedPrescription: string;
}> {
  try {
    // Generate summary
    const summary = await generateSummary(transcript, summaryPrompt);
    
    // Generate diagnosis and prescription
    const { diagnosis, prescription } = await generateDiagnosisAndPrescription(
      transcript,
      clinicPrompt
    );
    
    return {
      summary,
      suggestedDiagnosis: diagnosis,
      suggestedPrescription: prescription,
    };
  } catch (error) {
    console.error('Error analyzing transcript:', error);
    throw error;
  }
}

