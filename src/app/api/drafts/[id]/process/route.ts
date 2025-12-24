import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { transcribeAudioElevenlabs } from '@/lib/elevenlabs';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the draft session
    const draftResult = await pool.query(
      `SELECT audio_url
       FROM draft_sessions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (draftResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    const { audio_url } = draftResult.rows[0];

    // Fetch the audio file from R2
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error('Failed to fetch audio file');
    }
    const audioBlob = await audioResponse.blob();

    // Transcribe the audio
    const transcript = await transcribeAudioElevenlabs(audioBlob, userId);

    // Analyze the transcript
    const analysisResponse = await fetch('/api/sessions/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        transcript
      }),
    });

    if (!analysisResponse.ok) {
      throw new Error('Failed to analyze transcript');
    }

    const { analysis } = await analysisResponse.json();

    // Create a new session from the draft
    const sessionResult = await pool.query(
      `INSERT INTO patient_sessions (
        name,
        age,
        transcript,
        summary,
        suggested_diagnosis,
        suggested_prescription,
        final_diagnosis,
        final_prescription,
        examination_results,
        treatment_plan,
        doctor_notes,
        document_url,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      RETURNING id`,
      [
        '', // name
        '', // age
        transcript,
        analysis.summary,
        analysis.suggestedDiagnosis,
        analysis.suggestedPrescription,
        analysis.suggestedDiagnosis, // Use suggested as final initially
        analysis.suggestedPrescription, // Use suggested as final initially
        '', // examination_results
        '', // treatment_plan
        '', // doctor_notes
        null // document_url - will be generated when the session is completed
      ]
    );

    const sessionId = sessionResult.rows[0].id;

    // Link the session to the user
    await pool.query(
      `INSERT INTO user_sessions (user_id, session_id)
       VALUES ($1, $2)`,
      [userId, sessionId]
    );

    // Delete the draft
    await pool.query(
      `DELETE FROM draft_sessions
       WHERE id = $1`,
      [id]
    );

    return NextResponse.json({
      success: true,
      sessionId,
      transcript,
      analysis
    });
  } catch (error) {
    console.error('Error processing draft:', error);
    return NextResponse.json(
      { error: 'Failed to process draft' },
      { status: 500 }
    );
  }
} 