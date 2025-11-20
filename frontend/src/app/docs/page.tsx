/**
 * Documentation Page
 * Browse and view project documentation markdown files
 */

'use client';

import { useEffect, useState } from 'react';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';
import {
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { FileText, BookOpen, Folder, ChevronRight } from 'lucide-react';

interface DocFile {
  path: string;
  name: string;
  category: string;
}

interface GroupedDocs {
  [category: string]: DocFile[];
}

export default function DocsPage() {
  const [files, setFiles] = useState<DocFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);

  // Fetch list of markdown files
  useEffect(() => {
    fetch('/api/docs')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setFiles(data.files);
          // Auto-select first file
          if (data.files.length > 0) {
            loadFile(data.files[0].path);
          }
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load documentation files:', error);
        setLoading(false);
      });
  }, []);

  // Load file content
  const loadFile = (filePath: string) => {
    setSelectedFile(filePath);
    setContentLoading(true);

    fetch(`/api/docs?file=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setContent(data.content);
        }
        setContentLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load file content:', error);
        setContentLoading(false);
      });
  };

  // Group files by category
  const groupedDocs: GroupedDocs = files.reduce((acc, file) => {
    if (!acc[file.category]) {
      acc[file.category] = [];
    }
    acc[file.category].push(file);
    return acc;
  }, {} as GroupedDocs);

  const selectedFileName = files.find((f) => f.path === selectedFile)?.name || '';

  return (
    <SidebarInset>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Documentation</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <div className="bg-primary text-primary-foreground flex aspect-square size-10 items-center justify-center rounded-lg">
            <BookOpen className="size-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Documentation</h1>
            <p className="text-sm text-muted-foreground">
              Browse project documentation, architecture, and guides
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* File Browser Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Folder className="h-4 w-4" />
                Documentation Files
              </CardTitle>
              <CardDescription>
                {files.length} markdown files
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-16rem)]">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading files...</div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedDocs).map(([category, categoryFiles]) => (
                      <div key={category} className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Folder className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">{category}</span>
                          <Badge variant="secondary" className="text-xs">
                            {categoryFiles.length}
                          </Badge>
                        </div>
                        <div className="ml-6 space-y-1">
                          {categoryFiles.map((file) => (
                            <Button
                              key={file.path}
                              variant={selectedFile === file.path ? 'secondary' : 'ghost'}
                              size="sm"
                              className="w-full justify-start text-left h-auto py-2"
                              onClick={() => loadFile(file.path)}
                            >
                              <FileText className="h-3 w-3 mr-2 shrink-0" />
                              <span className="text-xs truncate">{file.name}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Document Viewer */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedFileName || 'Select a document'}
              </CardTitle>
              {selectedFile && (
                <CardDescription className="font-mono text-xs">
                  {selectedFile}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-16rem)]">
                {contentLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">Loading content...</div>
                  </div>
                ) : content ? (
                  <div className="pr-4">
                    <MarkdownRenderer content={content} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <BookOpen className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      Select a document from the sidebar to view
                    </p>
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </SidebarInset>
  );
}
