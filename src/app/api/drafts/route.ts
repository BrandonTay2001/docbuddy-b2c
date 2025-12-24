import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { uploadToR2 } from '@/lib/r2';

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

    const result = await pool.query(
      `SELECT *
       FROM draft_sessions
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    return NextResponse.json({ drafts: result.rows });
  } catch (error) {
    console.error('Error fetching drafts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drafts' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { userId, audioBlob } = await request.json();

    if (!userId || !audioBlob) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Convert base64 to buffer
    const base64Data = audioBlob.split(',')[1];
    const audioBuffer = Buffer.from(base64Data, 'base64');

    // Upload to R2
    const filePath = `drafts/${userId}/${Date.now()}.webm`;
    
    // Get the full URL back from the uploadToR2 function
    const fullAudioUrl = await uploadToR2(
      audioBuffer,
      filePath,
      'audio/webm'
    );

    // Save full URL to database
    const result = await pool.query(
      `INSERT INTO draft_sessions (user_id, audio_url)
       VALUES ($1, $2)
       RETURNING id`,
      [userId, fullAudioUrl]
    );

    return NextResponse.json({
      draftId: result.rows[0].id,
      audioUrl: fullAudioUrl
    });
  } catch (error: unknown) {
    console.error('Error saving draft:', error);
    return NextResponse.json(
      { error: 'Failed to save draft' },
      { status: 500 }
    );
  }
}