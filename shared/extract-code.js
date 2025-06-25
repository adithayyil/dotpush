// Code extraction function for LeetCode pages
// This function runs in the context of the LeetCode page to extract user's code

function extractCodeFromPage() {
  // === dotpush V6 Extractor (runs in page MAIN world) ===
  const debug = [];
  let extractedCode = "";
  let method = "";

  function detectLanguage(code) {
    const clean = code || "";
    
    // C++ detection
    if (/#include\s*<.*>/.test(code) && (/std::/.test(code) || /cout/.test(code) || /cin/.test(code))) return 'cpp';
    if (/class\s+Solution\s*{/.test(code) && /#include/.test(code)) return 'cpp';
    
    // Java detection  
    if (/public\s+class\s+\w+/.test(code) && /public\s+\w+.*\(/.test(code)) return 'java';
    if (/class\s+Solution\s*{/.test(code) && /public\s+/.test(code)) return 'java';
    
    // C# detection
    if (/using\s+System/.test(code) || /namespace\s+\w+/.test(code)) return 'csharp';
    if (/public\s+class\s+\w+/.test(code) && /Console\./.test(code)) return 'csharp';
    
    // JavaScript detection
    if (/var\s+\w+\s*=\s*function/.test(code) || /function\s+\w+\s*\(/.test(code)) return 'javascript';
    if (/const\s+\w+\s*=\s*\(/.test(code) || /=>\s*{/.test(code)) return 'javascript';
    if (/let\s+\w+/.test(code) && /=>\s*/.test(code)) return 'javascript';
    
    // TypeScript detection
    if (/:\s*(number|string|boolean)\s*[,\)]/.test(code)) return 'typescript';
    if (/interface\s+\w+/.test(code) || /type\s+\w+\s*=/.test(code)) return 'typescript';
    
    // PHP detection
    if (/<\?php/.test(code) || /\$\w+/.test(code)) return 'php';
    
    // Swift detection
    if (/func\s+\w+\s*\(/.test(code) && (/class\s+Solution/.test(code) || /var\s+\w+:\s*/.test(code))) return 'swift';
    if (/import\s+Foundation/.test(code) || /\[\w+\]/.test(code)) return 'swift';
    
    // Kotlin detection
    if (/fun\s+\w+\s*\(/.test(code) && /class\s+Solution/.test(code)) return 'kotlin';
    if (/class\s+Solution\s*{/.test(code) && /fun\s+/.test(code)) return 'kotlin';
    
    // Dart detection
    if (/void\s+main\s*\(\s*\)/.test(code) || /class\s+\w+\s*{/.test(code) && /dart/.test(code)) return 'dart';
    if (/import\s+'dart:/.test(code)) return 'dart';
    
    // Go detection
    if (/func\s+\w+\s*\(/.test(code) && /\*\w+/.test(code)) return 'go';
    if (/package\s+main/.test(code) || /func\s+main\s*\(\s*\)/.test(code)) return 'go';
    if (/import\s+\(/.test(code) || /fmt\./.test(code)) return 'go';
    
    // Ruby detection
    if (/def\s+\w+/.test(code) && /end/.test(code)) return 'ruby';
    if (/class\s+\w+/.test(code) && /def\s+/.test(code) && /end/.test(code)) return 'ruby';
    
    // Scala detection
    if (/object\s+\w+/.test(code) || /def\s+\w+\s*\(/.test(code) && /scala/.test(code)) return 'scala';
    if (/import\s+scala\./.test(code)) return 'scala';
    
    // Rust detection
    if (/fn\s+\w+\s*\(/.test(code) && (/impl\s+/.test(code) || /struct\s+/.test(code))) return 'rust';
    if (/use\s+std::/.test(code) || /let\s+mut\s+/.test(code)) return 'rust';
    
    // Racket detection
    if (/\(define\s+/.test(code) || /\(lambda\s+/.test(code)) return 'racket';
    if (/#lang\s+racket/.test(code)) return 'racket';
    
    // Erlang detection
    if (/-module\s*\(/.test(code) || /-export\s*\(/.test(code)) return 'erlang';
    if (/\w+\s*\(\s*\)\s*->/.test(code) && /\./.test(code)) return 'erlang';
    
    // Elixir detection
    if (/defmodule\s+\w+/.test(code) || /def\s+\w+\s*do/.test(code)) return 'elixir';
    if (/IO\.puts/.test(code) || /Enum\./.test(code)) return 'elixir';
    
    // Python detection (including Python3)
    if (/class\s+Solution\s*:/.test(code) || /def\s+\w+\s*\(/.test(code)) return 'python';
    if (/import\s+\w+/.test(code) || /from\s+\w+\s+import/.test(code)) return 'python';
    
    // C detection
    if (/#include\s*<.*\.h>/.test(code) && !/std::/.test(code) && !/cout/.test(code)) return 'c';
    if (/int\s+main\s*\(\s*(void)?\s*\)/.test(code)) return 'c';
    
    // Default fallback based on simple patterns
    if (/def\s+/.test(code)) return 'python';
    if (/func\s+/.test(code) && !/fun\s+/.test(code)) return 'go';
    if (/fun\s+/.test(code)) return 'kotlin';
    if (/public\s+class/.test(code)) return 'java';
    if (/function\s+/.test(code)) return 'javascript';
    
    return 'python'; // Default fallback
  }

  // 1) Monaco Editor - Most reliable for LeetCode
  try {
    if (window.monaco && window.monaco.editor) {
      const models = window.monaco.editor.getModels();
      debug.push('monaco models:' + models.length);
      for (const m of models) {
        const val = m.getValue();
        if (val && val.trim().length > 10 && val.length > extractedCode.length) { 
          extractedCode = val; 
          method = 'Monaco Editor'; 
        }
      }
    }
  } catch (e) { debug.push('monaco error:' + e.message); }

  // 2) CodeMirror - Common alternative editor
  if (!extractedCode && window.CodeMirror) {
    try {
      const cmEls = Array.from(document.querySelectorAll('.CodeMirror'));
      debug.push('codemirror elements:' + cmEls.length);
      cmEls.forEach((el, idx) => {
        if (el.CodeMirror && el.CodeMirror.getValue) {
          const val = el.CodeMirror.getValue();
          if (val && val.trim().length > 10 && val.length > extractedCode.length) { 
            extractedCode = val; 
            method = 'CodeMirror #' + idx; 
          }
        }
      });
    } catch (e) { debug.push('cm error:' + e.message); }
  }

  // 3) Textareas - Look for large textareas with code
  if (!extractedCode) {
    const tArr = Array.from(document.querySelectorAll('textarea'));
    debug.push('textareas:' + tArr.length);
    tArr.forEach((ta, idx) => {
      const v = ta.value || '';
      // Only consider textareas with substantial content that looks like code
      if (v.trim().length > 10 && v.length > extractedCode.length && 
          (v.includes('{') || v.includes('def ') || v.includes('func ') || v.includes('class '))) {
        extractedCode = v; 
        method = 'Textarea #' + idx;
      }
    });
  }

  // 4) Advanced DOM text extraction - Look for code containers
  if (!extractedCode) {
    const selectors = [
      '[class*="editor"]',
      '[id*="editor"]', 
      '[class*="code"]',
      '[id*="code"]',
      'pre code',
      '.monaco-editor',
      '[class*="codemirror"]',
      '[data-cy*="code"]',
      '[data-testid*="code"]'
    ];
    
    const candidates = Array.from(document.querySelectorAll(selectors.join(', ')));
    debug.push('code-like elements:' + candidates.length);
    
    candidates.forEach((el, idx) => {
      const txt = el.textContent || el.innerText || '';
      // Only consider elements with substantial code-like content
      if (txt.trim().length > 10 && txt.length > extractedCode.length &&
          (txt.includes('{') || txt.includes('def ') || txt.includes('func ') || 
           txt.includes('class ') || txt.includes('function ') || txt.includes('import '))) {
        extractedCode = txt.trim(); 
        method = 'DOM Element #' + idx + ' (' + el.tagName + ')';
      }
    });
  }

  return {
    ok: !!extractedCode,
    code: (extractedCode || '').trim(),
    language: detectLanguage(extractedCode),
    method,
    debug
  };
}

// Execute the extraction
extractCodeFromPage();
