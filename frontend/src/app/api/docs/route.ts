/**
 * API Route: Documentation Files
 * Returns list of available markdown files and their contents
 */

import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const PROJECT_ROOT = join(process.cwd(), '..');
const DOCS_LOCATIONS = [
  'docs',
  '',  // Root level
  'frontend',
];

interface DocFile {
  path: string;
  name: string;
  category: string;
}

/**
 * Recursively find all .md files in given directories
 */
function findMarkdownFiles(baseDir: string, category: string): DocFile[] {
  const files: DocFile[] = [];
  const fullPath = join(PROJECT_ROOT, baseDir);

  try {
    const items = readdirSync(fullPath);

    for (const item of items) {
      // Skip hidden, build, and dependency folders
      if (
        item.startsWith('.') ||
        item === 'node_modules' ||
        item === '.pio' ||
        item === 'dist' ||
        item === 'build'
      ) {
        continue;
      }

      const itemPath = join(fullPath, item);
      const stat = statSync(itemPath);

      if (stat.isDirectory()) {
        // Recursively search subdirectories
        const subCategory = baseDir ? `${category}/${item}` : item;
        files.push(...findMarkdownFiles(join(baseDir, item), subCategory));
      } else if (item.endsWith('.md')) {
        const relativePath = relative(PROJECT_ROOT, itemPath);
        files.push({
          path: relativePath,
          name: item,
          category: category || 'Root',
        });
      }
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
    console.warn(`Could not read directory: ${fullPath}`);
  }

  return files;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const filePath = searchParams.get('file');

  // If file parameter provided, return file contents
  if (filePath) {
    try {
      const fullPath = join(PROJECT_ROOT, filePath);
      const content = readFileSync(fullPath, 'utf-8');

      return NextResponse.json({
        success: true,
        content,
        path: filePath,
      });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'File not found',
        },
        { status: 404 }
      );
    }
  }

  // Otherwise, return list of all markdown files
  const allFiles: DocFile[] = [];
  const seenPaths = new Set<string>();

  for (const location of DOCS_LOCATIONS) {
    const files = findMarkdownFiles(location, location || 'Root');

    // Deduplicate files by path
    for (const file of files) {
      if (!seenPaths.has(file.path)) {
        seenPaths.add(file.path);
        allFiles.push(file);
      }
    }
  }

  // Sort by category and name
  allFiles.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    success: true,
    files: allFiles,
  });
}
