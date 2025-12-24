import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

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

        // Query the database for usage statistics
        const result = await pool.query(
            `SELECT year, month, minutes_used 
             FROM transcription_usage 
             WHERE user_id = $1 
             ORDER BY year DESC, month DESC`,
            [userId]
        );

        return NextResponse.json({ usage: result.rows });
    } catch (error) {
        console.error('Error fetching usage statistics:', error);
        return NextResponse.json(
            { error: 'Failed to fetch usage data' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const { userId, minutes } = await request.json();

        if (!userId || typeof minutes !== 'number') {
            return NextResponse.json(
                { error: 'Invalid request parameters' },
                { status: 400 }
            );
        }

        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // JavaScript months are 0-based

        await pool.query(
            `INSERT INTO transcription_usage (user_id, year, month, minutes_used)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id, year, month) 
             DO UPDATE SET 
                minutes_used = transcription_usage.minutes_used + $4,
                updated_at = CURRENT_TIMESTAMP`,
            [userId, year, month, minutes]
        );

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating transcription usage:', error);
        return NextResponse.json(
            { error: 'Failed to update usage data' },
            { status: 500 }
        );
    }
} 