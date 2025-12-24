import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { uploadToR2 } from '@/lib/r2';

export async function GET(
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

    const result = await pool.query(
      `SELECT *
       FROM draft_sessions
       WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ draft: result.rows[0] });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json(
      { error: 'Failed to fetch draft' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, audioBlob, isFinal = false } = await request.json();

    if (!userId || !audioBlob) {
      return NextResponse.json(
        { error: 'User ID and audio blob are required' },
        { status: 400 }
      );
    }

    // Get the current draft to check ownership
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

    // Convert base64 to buffer
    const audioData = audioBlob.split(',')[1];
    const audioBuffer = Buffer.from(audioData, 'base64');
    
    // Generate a filename that indicates this is an update
    // Use timestamp to prevent caching issues
    const filePath = `drafts/${userId}/${id}_${Date.now()}${isFinal ? '_final' : ''}.mp3`;
    
    // Upload to R2 with the new filename
    const fullAudioUrl = await uploadToR2(
      audioBuffer,
      filePath,
      'audio/mp3'
    );

    // Update the draft with the full URL (uploadToR2 already returns the complete URL)
    await pool.query(
      `UPDATE draft_sessions
       SET audio_url = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [fullAudioUrl, id]
    );

    return NextResponse.json({
      success: true,
      draftId: id,
      audioUrl: fullAudioUrl
    });
  } catch (error) {
    console.error('Error updating draft:', error);
    return NextResponse.json(
      { error: 'Failed to update draft' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { userId, title } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Update the draft title
    const result = await pool.query(
      `UPDATE draft_sessions
       SET title = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [title, id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      draft: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating draft title:', error);
    return NextResponse.json(
      { error: 'Failed to update draft title' },
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
    
    // Get userId from request body for consistency with sessions
    const body = await request.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Delete the draft
    const result = await pool.query(
      `DELETE FROM draft_sessions
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Draft not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Draft deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting draft:', error);
    return NextResponse.json(
      { error: 'Failed to delete draft' },
      { status: 500 }
    );
  }
}