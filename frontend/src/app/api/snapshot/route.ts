/**
 * API Route: POST /api/snapshot
 * Saves a debug snapshot to the snapshots folder
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `snapshot_${timestamp}.json`;
    const filepath = join(process.cwd(), 'snapshots', filename);

    // Format JSON with pretty printing
    const jsonContent = JSON.stringify(data, null, 2);

    // Write file
    await writeFile(filepath, jsonContent, 'utf-8');

    return NextResponse.json({
      success: true,
      filename,
      filepath,
      message: 'Snapshot saved successfully',
    });
  } catch (error) {
    console.error('Error saving snapshot:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save snapshot',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
