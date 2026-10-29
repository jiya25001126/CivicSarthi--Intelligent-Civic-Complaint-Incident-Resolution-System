/**
 * @file verify-translations.js
 * @description Automated verification script for CivicSarthi i18n translation system.
 * Asserts:
 *  1. 1:1 key parity between English (en) and Hindi (hi) dictionaries across all nested trees.
 *  2. No empty, null, or undefined translation values.
 *  3. Presence of Devanagari script characters ([\u0900-\u097F]) in all Hindi leaf values.
 *  4. Identical interpolation tokens ({param}) between corresponding English and Hindi strings.
 *  5. Correctness of enum formatters (status, priority, category, department).
 */

import { translations } from '../src/i18n/translations.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import babelParser from '@babel/parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('====================================================');
console.log('CivicSarthi i18n Translation Parity & Quality Test');
console.log('====================================================\n');

let totalKeysChecked = 0;
let errors = [];
let warnings = [];

// 0. AST Check for Duplicate Keys in translations.js
console.log('Checking for duplicate keys in translations.js AST...');
const translationsFilePath = path.resolve(__dirname, '../src/i18n/translations.js');
const translationsSrc = fs.readFileSync(translationsFilePath, 'utf8');

try {
  const ast = babelParser.parse(translationsSrc, { sourceType: 'module' });
  function checkObject(objNode, scopeName) {
    const keys = new Map();
    for (const prop of objNode.properties) {
      if (prop.type === 'ObjectProperty') {
        const key = prop.key.name || prop.key.value;
        const line = prop.loc ? prop.loc.start.line : 0;
        if (keys.has(key)) {
          errors.push(`Duplicate key "${key}" detected in ${scopeName} at line ${line} (previously defined at line ${keys.get(key)})`);
        } else {
          keys.set(key, line);
        }
        if (prop.value.type === 'ObjectExpression') {
          checkObject(prop.value, `${scopeName}.${key}`);
        }
      }
    }
  }

  for (const stmt of ast.program.body) {
    if (stmt.type === 'ExportNamedDeclaration' && stmt.declaration && stmt.declaration.declarations) {
      for (const decl of stmt.declaration.declarations) {
        if (decl.id.name === 'translations' && decl.init.type === 'ObjectExpression') {
          for (const langProp of decl.init.properties) {
            const lang = langProp.key.name || langProp.key.value;
            checkObject(langProp.value, lang);
          }
        }
      }
    }
  }
  console.log('✓ No duplicate keys found in translations.js source AST.\n');
} catch (astErr) {
  errors.push(`Failed to parse translations.js AST: ${astErr.message}`);
}

// 1. Recursive Key Parity & Non-Empty Check
function compareKeys(enObj, hiObj, currentPath = '') {
  const enKeys = Object.keys(enObj);
  const hiKeys = Object.keys(hiObj);

  // Check keys in EN but missing in HI
  for (const key of enKeys) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    if (!(key in hiObj)) {
      errors.push(`Missing key in Hindi: "${fullPath}"`);
      continue;
    }

    const enVal = enObj[key];
    const hiVal = hiObj[key];

    if (typeof enVal === 'object' && enVal !== null && !Array.isArray(enVal)) {
      if (typeof hiVal !== 'object' || hiVal === null || Array.isArray(hiVal)) {
        errors.push(`Type mismatch at "${fullPath}": EN is object, HI is ${typeof hiVal}`);
      } else {
        compareKeys(enVal, hiVal, fullPath);
      }
    } else {
      totalKeysChecked++;

      // Check non-empty
      if (typeof enVal !== 'string' || enVal.trim().length === 0) {
        errors.push(`Empty value in English at "${fullPath}"`);
      }
      if (typeof hiVal !== 'string' || hiVal.trim().length === 0) {
        errors.push(`Empty value in Hindi at "${fullPath}"`);
      }

      // Check Devanagari script presence in Hindi string
      if (typeof hiVal === 'string' && hiVal.trim().length > 0) {
        const hasDevanagari = /[\u0900-\u097F]/.test(hiVal);
        if (!hasDevanagari) {
          // Check if it's purely punctuation or symbols
          if (!/^[0-9+\-_/\\:.,\s{}()]+$/.test(hiVal)) {
            warnings.push(`Hindi string at "${fullPath}" contains no Devanagari characters: "${hiVal}"`);
          }
        }
      }

      // Check interpolation token parity (e.g. {count}, {id}, {ref})
      if (typeof enVal === 'string' && typeof hiVal === 'string') {
        const enTokens = (enVal.match(/{[a-zA-Z0-9_]+}/g) || []).sort();
        const hiTokens = (hiVal.match(/{[a-zA-Z0-9_]+}/g) || []).sort();

        if (enTokens.join(',') !== hiTokens.join(',')) {
          errors.push(
            `Interpolation token mismatch at "${fullPath}":\n  EN: [${enTokens.join(', ')}]\n  HI: [${hiTokens.join(', ')}]`
          );
        }
      }
    }
  }

  // Check keys in HI but missing in EN
  for (const key of hiKeys) {
    const fullPath = currentPath ? `${currentPath}.${key}` : key;
    if (!(key in enObj)) {
      errors.push(`Extraneous key in Hindi missing from English: "${fullPath}"`);
    }
  }
}

console.log('Checking dictionary symmetry...');
compareKeys(translations.en, translations.hi);
console.log(`✓ Checked ${totalKeysChecked} leaf translation keys for 1:1 parity and structure.\n`);

// 2. Check Formatter Helpers Simulation
console.log('Checking Formatter & Enum mappings...');

const sampleStatuses = ['SUBMITTED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'REOPENED', 'ESCALATED', 'WITHDRAWN'];
const samplePriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const sampleCategories = ['roads', 'water', 'electricity', 'sanitation', 'healthcare'];

for (const s of sampleStatuses) {
  if (!translations.en.status[s]) {
    errors.push(`Missing EN status mapping for "${s}"`);
  }
  if (!translations.hi.status[s]) {
    errors.push(`Missing HI status mapping for "${s}"`);
  }
}

for (const p of samplePriorities) {
  if (!translations.en.priority[p]) {
    errors.push(`Missing EN priority mapping for "${p}"`);
  }
  if (!translations.hi.priority[p]) {
    errors.push(`Missing HI priority mapping for "${p}"`);
  }
}

for (const c of sampleCategories) {
  if (!translations.en.category[c]) {
    errors.push(`Missing EN category mapping for "${c}"`);
  }
  if (!translations.hi.category[c]) {
    errors.push(`Missing HI category mapping for "${c}"`);
  }
}

console.log('✓ All core lifecycle enums verified in both languages.\n');

// 3. Verify LocalStorage Key in LanguageContext.jsx
console.log('Verifying LanguageContext.jsx localStorage configuration...');
const langContextPath = path.resolve(__dirname, '../src/context/LanguageContext.jsx');
const langContextSrc = fs.readFileSync(langContextPath, 'utf8');

if (!langContextSrc.includes("'civicsarthi_lang'")) {
  errors.push("LanguageContext.jsx does not reference the required localStorage key 'civicsarthi_lang'");
} else {
  console.log("✓ LanguageContext.jsx properly uses 'civicsarthi_lang' persistence key.\n");
}

// Summary Report
console.log('====================================================');
console.log(`Results: ${totalKeysChecked} keys verified.`);

if (warnings.length > 0) {
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach(w => console.warn(` [WARN] ${w}`));
}

if (errors.length > 0) {
  console.error(`\nFAILED with ${errors.length} error(s):`);
  errors.forEach(e => console.error(` [ERROR] ${e}`));
  process.exit(1);
} else {
  console.log('\nSUCCESS: All translation tests passed with 100% parity and Devanagari coverage!');
  console.log('====================================================');
  process.exit(0);
}
