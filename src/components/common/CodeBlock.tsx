
import React, { useState } from 'react';

interface CodeBlockProps {
  language: string | undefined;
  children: React.ReactNode;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, children }) => {
  const [copied, setCopied] = useState(false);
  const textToCopy = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // console.error('Failed to copy text: ', err); // Removed
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <button onClick={handleCopy} className="copy-code-button chat-interactive-button" aria-label="Скопировать код">
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>
      <pre><code className={`language-${language}`}>{children}</code></pre>
    </div>
  );
};
