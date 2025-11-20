/**
 * Markdown Renderer Component
 * Renders markdown with mermaid diagram support
 */

'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';
import mermaid from 'mermaid';
import './markdown-github.css';

interface MarkdownRendererProps {
  content: string;
}

// Initialize mermaid with neutral theme
mermaid.initialize({
  startOnLoad: true,
  theme: 'neutral',
  securityLevel: 'loose',
  fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: 'basis',
  },
  sequence: {
    useMaxWidth: true,
    wrap: true,
    showSequenceNumbers: true,
  },
});

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Render mermaid diagrams after markdown is rendered
    if (containerRef.current) {
      const mermaidBlocks = containerRef.current.querySelectorAll('pre code.language-mermaid');

      mermaidBlocks.forEach((block, index) => {
        const mermaidCode = block.textContent || '';
        const id = `mermaid-${index}-${Date.now()}`;

        // Create a new div for the mermaid diagram
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid';
        mermaidDiv.textContent = mermaidCode;

        // Replace the code block with the mermaid div
        if (block.parentElement) {
          block.parentElement.replaceWith(mermaidDiv);
        }
      });

      // Re-run mermaid on all diagrams
      mermaid.run({
        querySelector: '.mermaid',
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="markdown-body"
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={{
          // Custom code block renderer
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';

            // Check if it's a code block (has language class) vs inline code
            const isCodeBlock = className?.includes('language-');

            if (isCodeBlock && language === 'mermaid') {
              // Mermaid diagrams will be processed by useEffect
              return (
                <pre>
                  <code className={className} {...props}>
                    {children}
                  </code>
                </pre>
              );
            }

            return isCodeBlock ? (
              <pre>
                <code className={className} {...props}>
                  {children}
                </code>
              </pre>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
