import markdownpdf from 'markdown-pdf';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputFile = path.join(__dirname, '..', '..', 'FEATURE_SUGGESTIONS.md');
const outputFile = path.join(__dirname, '..', '..', 'FEATURE_SUGGESTIONS.pdf');

console.log('Converting markdown to PDF...');
console.log('Input:', inputFile);
console.log('Output:', outputFile);

markdownpdf()
  .from(inputFile)
  .to(outputFile, function() {
    console.log('\n✅ PDF created successfully!');
    console.log('📄 Location:', outputFile);
  });
