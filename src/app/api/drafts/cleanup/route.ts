import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { userId, olderThanHours = 24 } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Delete drafts older than specified hours
    const result = await pool.query(
      `DELETE FROM draft_sessions 
       WHERE user_id = $1 
       AND created_at < NOW() - INTERVAL '${olderThanHours} hours'
       RETURNING id`,
      [userId]
    );

    return NextResponse.json({
      success: true,
      deletedCount: result.rows.length,
      deletedIds: result.rows.map(row => row.id)
    });
  } catch (error) {
    console.error('Error cleaning up drafts:', error);
    return NextResponse.json(
      { error: 'Failed to cleanup drafts' },
      { status: 500 }
    );
  }
}
