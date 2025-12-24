import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { generateMedicalDocumentHtml } from '@/lib/pdf';
import { uploadToR2, uploadMediaToR2 } from '@/lib/r2';

// Initialize PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export async function GET(
  request: NextRequest,
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

    const query = `
      SELECT ps.*
      FROM patient_sessions ps
      JOIN user_sessions us ON ps.id = us.session_id
      WHERE ps.id = $1 AND us.user_id = $2;
    `;

    const result = await pool.query(query, [id, userId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: result.rows[0]
    });

  } catch (error) {
    console.error('Error fetching session:', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

interface SessionUpdateData {
  transcript: string;
  summary: string;
  examinationResults: string;
  diagnosis: string;
  prescription: string;
  treatmentPlan: string;
  doctorNotes: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const contentType = request.headers.get('content-type');
    
    let userId: string;
    let sessionData: SessionUpdateData;
    const mediaUrls: string[] = [];
    let existingMediaUrls: string[] = [];
    let mediaToDelete: string[] = [];

    if (contentType?.includes('multipart/form-data')) {
      // Handle FormData (with media files)
      const formData = await request.formData();
      
      userId = formData.get('userId') as string;
      if (!userId) {
        return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
      }

      sessionData = {
        transcript: formData.get('transcript') as string,
        summary: formData.get('summary') as string,
        examinationResults: formData.get('examinationResults') as string,
        diagnosis: formData.get('diagnosis') as string,
        prescription: formData.get('prescription') as string,
        treatmentPlan: formData.get('treatmentPlan') as string,
        doctorNotes: formData.get('doctorNotes') as string,
      };

      // Parse existing media URLs to keep
      const existingMediaStr = formData.get('existingMediaUrls') as string;
      if (existingMediaStr) {
        try {
          existingMediaUrls = JSON.parse(existingMediaStr);
        } catch (e) {
          console.error('Failed to parse existing media URLs:', e);
        }
      }

      // Parse media URLs to delete
      const mediaToDeleteStr = formData.get('mediaToDelete') as string;
      if (mediaToDeleteStr) {
        try {
          mediaToDelete = JSON.parse(mediaToDeleteStr);
        } catch (e) {
          console.error('Failed to parse media to delete:', e);
        }
      }

      // Extract and upload new media files
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
    } else {
      // Handle JSON (text-only updates)
      const body = await request.json();
      userId = body.userId;
      sessionData = body;
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get current session data
      const currentSessionResult = await client.query(
        `SELECT ps.*
         FROM patient_sessions ps
         JOIN user_sessions us ON ps.id = us.session_id
         WHERE ps.id = $1 AND us.user_id = $2`,
        [id, userId]
      );

      if (currentSessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        );
      }
      
      // Combine existing media URLs (that aren't being deleted) with new ones
      const allMediaUrls = [...existingMediaUrls, ...mediaUrls];

      // Update session data
      const updateQuery = `
        UPDATE patient_sessions 
        SET 
          transcript = $1,
          summary = $2,
          examination_results = $3,
          final_diagnosis = $4,
          final_prescription = $5,
          treatment_plan = $6,
          doctor_notes = $7,
          media_urls = $8
        WHERE id = $9
        RETURNING *;
      `;

      const updateValues = [
        sessionData.transcript,
        sessionData.summary,
        sessionData.examinationResults,
        sessionData.diagnosis,
        sessionData.prescription,
        sessionData.treatmentPlan,
        sessionData.doctorNotes,
        allMediaUrls.length > 0 ? allMediaUrls : null,
        id
      ];

      const updateResult = await client.query(updateQuery, updateValues);
      const updatedSession = updateResult.rows[0];

      // Generate new document
      const documentData = {
        patientName: updatedSession.name,
        patientAge: updatedSession.age.toString(),
        date: new Date().toLocaleDateString(),
        summary: sessionData.summary || '',
        examinationResults: sessionData.examinationResults || undefined,
        diagnosis: sessionData.diagnosis,
        prescription: sessionData.prescription,
        treatmentPlan: sessionData.treatmentPlan || undefined,
        doctorNotes: sessionData.doctorNotes || undefined,
        mediaUrls: allMediaUrls.length > 0 ? allMediaUrls : undefined,
      };

      const htmlContent = generateMedicalDocumentHtml(documentData);
      const htmlBuffer = Buffer.from(htmlContent, 'utf-8');
      
      // Upload updated document to R2
      const timestamp = Date.now();
      const documentFileName = `documents/${userId}/${updatedSession.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.html`;
      const documentUrl = await uploadToR2(htmlBuffer, documentFileName, 'text/html');

      // Update document URL
      await client.query(
        'UPDATE patient_sessions SET document_url = $1 WHERE id = $2',
        [documentUrl, id]
      );

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        documentUrl,
        mediaCount: mediaUrls.length,
        deletedCount: mediaToDelete.length
      });

    } catch (error) {
      console.error('Error updating session:', error);
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error updating session:', error);
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get userId from request body
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Verify the session belongs to the user and delete it
    const result = await pool.query(
      `DELETE FROM patient_sessions
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Session not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}