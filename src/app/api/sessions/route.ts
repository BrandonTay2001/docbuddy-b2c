import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateMedicalDocumentHtml } from '@/lib/pdf';
import { uploadToR2, uploadMediaToR2 } from '@/lib/r2';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Heroku
  }
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const query = `
      SELECT ps.*
      FROM patient_sessions ps
      JOIN user_sessions us ON ps.id = us.session_id
      WHERE us.user_id = $1
      ORDER BY ps.created_at DESC;
    `;

    const result = await pool.query(query, [userId]);

    return NextResponse.json({
      sessions: result.rows
    });

  } catch (error) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse FormData
    const formData = await request.formData();
    
    // Extract userId from FormData
    const userId = formData.get('userId') as string;
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Extract text fields
    const patientName = formData.get('patientName') as string;
    const patientAge = formData.get('patientAge') as string;
    const transcript = formData.get('transcript') as string || '';
    const summary = formData.get('summary') as string || '';
    const examinationResults = formData.get('examinationResults') as string || '';
    const suggestedDiagnosis = formData.get('suggestedDiagnosis') as string || '';
    const suggestedPrescription = formData.get('suggestedPrescription') as string || '';
    const finalDiagnosis = formData.get('finalDiagnosis') as string;
    const finalPrescription = formData.get('finalPrescription') as string;
    const treatmentPlan = formData.get('treatmentPlan') as string || '';
    const doctorNotes = formData.get('doctorNotes') as string || '';
    const draftId = formData.get('draftId') as string || null;

    // Extract and upload media files
    const mediaUrls: string[] = [];
    const entries = Array.from(formData.entries());
    
    for (const [key, value] of entries) {
      if (key.startsWith('mediaFile_') && value instanceof File) {
        try {
          const mediaUrl = await uploadMediaToR2(value, userId);
          mediaUrls.push(mediaUrl);
        } catch (error) {
          console.error(`Failed to upload media file ${value.name}:`, error);
          // Continue with other files, don't fail the entire request
        }
      }
    }

    // Generate document with media URLs
    const documentData = {
      patientName,
      patientAge,
      date: new Date().toLocaleDateString(),
      summary,
      examinationResults: examinationResults || undefined,
      diagnosis: finalDiagnosis,
      prescription: finalPrescription,
      treatmentPlan: treatmentPlan || undefined,
      doctorNotes: doctorNotes || undefined,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
    };

    const htmlContent = generateMedicalDocumentHtml(documentData);
    const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
    
    // Upload document to R2
    const timestamp = Date.now();
    const documentFileName = `documents/${userId}/${patientName.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.html`;
    const documentUrl = await uploadToR2(htmlBuffer, documentFileName, 'text/html');

    // Start a transaction to ensure all operations succeed or fail together
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert data into patient_sessions - FIXED: added media_urls column
      const sessionQuery = `
        INSERT INTO patient_sessions (
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
          media_urls,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING id::text;
      `;

      const sessionValues = [
        patientName,
        patientAge,
        transcript,
        summary,
        suggestedDiagnosis,
        suggestedPrescription,
        finalDiagnosis,
        finalPrescription,
        examinationResults,
        treatmentPlan,
        doctorNotes,
        documentUrl,
        mediaUrls.length > 0 ? mediaUrls : null, // FIXED: added media_urls value
      ];

      const sessionResult = await client.query(sessionQuery, sessionValues);
      const sessionId = sessionResult.rows[0].id;

      // Insert into user_sessions
      const userSessionQuery = `
        INSERT INTO user_sessions (user_id, session_id)
        VALUES ($1, $2)
        RETURNING id;
      `;

      await client.query(userSessionQuery, [userId, sessionId]);

      // Clean up drafts - delete all drafts for this user that might be related to this session
      if (draftId) {
        // Delete the specific draft
        await client.query(
          `DELETE FROM draft_sessions WHERE id = $1 AND user_id = $2`,
          [draftId, userId]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        sessionId,
        documentUrl,
        mediaCount: mediaUrls.length
      });

    } catch (error) {
      console.error('Error saving session:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error saving session:', error);
    return NextResponse.json(
      { error: 'Failed to save session' },
      { status: 500 }
    );
  }
}