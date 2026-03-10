/**
 * Batch script: Add theme support to all screen files
 * Replaces hardcoded dark-theme colors with useTheme() colors
 */
const fs = require('fs');
const path = require('path');

const SCREENS_DIR = path.join(__dirname, 'src', 'screens');

// Files to skip (already handled or special)
const SKIP_FILES = ['SettingsScreen.js'];

const files = fs.readdirSync(SCREENS_DIR).filter(f => f.endsWith('Screen.js') && !SKIP_FILES.includes(f));

let updated = 0;
let skipped = 0;

for (const file of files) {
    const filePath = path.join(SCREENS_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Check if file has hardcoded colors to replace
    const hasHardcodedBg = /backgroundColor:\s*['"]#0A0A0B['"]/.test(content) ||
        /backgroundColor:\s*['"]#0E0E0E['"]/.test(content) ||
        /backgroundColor:\s*['"]#1E1E2E['"]/.test(content) ||
        /backgroundColor:\s*['"]#1A1A2E['"]/.test(content);

    if (!hasHardcodedBg) {
        skipped++;
        continue;
    }

    // 1. Add import if not already present
    if (!content.includes("useTheme") && !content.includes("ThemeContext")) {
        // Find the last import line
        const importLines = content.split('\n');
        let lastImportIndex = -1;
        for (let i = 0; i < importLines.length; i++) {
            if (importLines[i].match(/^import\s/) || importLines[i].match(/^}\s*from\s/)) {
                lastImportIndex = i;
            }
        }
        if (lastImportIndex >= 0) {
            importLines.splice(lastImportIndex + 1, 0, "import { useTheme } from '../contexts/ThemeContext';");
            content = importLines.join('\n');
        }
    }

    // 2. Add const { colors } = useTheme(); after the function declaration
    // Look for "export default function XXXScreen" pattern
    if (!content.includes('useTheme()') || !content.includes('colors')) {
        // Find the component function and add useTheme after the first line inside it
        const funcMatch = content.match(/export default function \w+\([^)]*\)\s*\{/);
        if (funcMatch) {
            const funcIndex = content.indexOf(funcMatch[0]) + funcMatch[0].length;
            // Check if there's already a destructuring of useTheme
            const nextChunk = content.substring(funcIndex, funcIndex + 500);
            if (!nextChunk.includes('useTheme')) {
                content = content.substring(0, funcIndex) + '\n  const { colors } = useTheme();' + content.substring(funcIndex);
            }
        } else {
            // Try arrow function pattern: const XXXScreen = () => {  or ({ ... }) => {
            const arrowMatch = content.match(/(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\{)|(function\s+\w+Screen\s*\([^)]*\)\s*\{)/);
            if (arrowMatch) {
                const arrowIndex = content.indexOf(arrowMatch[0]) + arrowMatch[0].length;
                const nextChunk = content.substring(arrowIndex, arrowIndex + 500);
                if (!nextChunk.includes('useTheme')) {
                    content = content.substring(0, arrowIndex) + '\n  const { colors } = useTheme();' + content.substring(arrowIndex);
                }
            }
        }
    }

    // 3. Replace hardcoded colors in StyleSheet.create with themed versions
    // We need to move colors from StyleSheet to inline styles. 
    // Instead of modifying StyleSheet (static), we replace the actual style references.
    // Strategy: Replace hardcoded values throughout the file (both in StyleSheet and inline)

    // Background colors
    content = content.replace(/backgroundColor:\s*['"]#0A0A0B['"]/g, 'backgroundColor: colors.background');
    content = content.replace(/backgroundColor:\s*['"]#0E0E0E['"]/g, 'backgroundColor: colors.background');
    content = content.replace(/backgroundColor:\s*['"]#1E1E2E['"]/g, 'backgroundColor: colors.surface');
    content = content.replace(/backgroundColor:\s*['"]#1A1A2E['"]/g, 'backgroundColor: colors.card');
    content = content.replace(/backgroundColor:\s*['"]#151520['"]/g, 'backgroundColor: colors.cardAlt');
    content = content.replace(/backgroundColor:\s*['"]#1a1a1a['"]/g, 'backgroundColor: colors.inputBg');
    content = content.replace(/backgroundColor:\s*['"]#1A1A1A['"]/g, 'backgroundColor: colors.inputBg');

    // Text colors
    content = content.replace(/color:\s*['"]#fff['"]/g, 'color: colors.text');
    content = content.replace(/color:\s*['"]#FFF['"]/g, 'color: colors.text');
    content = content.replace(/color:\s*['"]#ffffff['"]/g, 'color: colors.text');
    content = content.replace(/color:\s*['"]#FFFFFF['"]/g, 'color: colors.text');
    content = content.replace(/color:\s*['"]#94A3B8['"]/g, 'color: colors.textSecondary');
    content = content.replace(/color:\s*['"]#64748B['"]/g, 'color: colors.textMuted');

    // Border colors
    content = content.replace(/borderColor:\s*['"]#2D2D3D['"]/g, 'borderColor: colors.border');
    content = content.replace(/borderColor:\s*['"]#333['"]/g, 'borderColor: colors.border');
    content = content.replace(/borderBottomColor:\s*['"]#1A1A1A['"]/g, 'borderBottomColor: colors.borderLight');
    content = content.replace(/borderBottomColor:\s*['"]#2D2D3D['"]/g, 'borderBottomColor: colors.border');

    // Primary/accent
    content = content.replace(/backgroundColor:\s*['"]#7C3AED['"]/g, 'backgroundColor: colors.primary');
    content = content.replace(/color:\s*['"]#7C3AED['"]/g, 'color: colors.primary');
    content = content.replace(/color:\s*['"]#8B5CF6['"]/g, 'color: colors.accent');

    // Error
    content = content.replace(/color:\s*['"]#EF4444['"]/g, 'color: colors.error');

    if (content !== original) {
        // Since StyleSheet.create is static and cannot use hooks, we need to convert
        // the styles that reference colors to be dynamic.
        // Check if the file uses StyleSheet and has colors.xxx inside it
        const styleSheetMatch = content.match(/const\s+styles\s*=\s*StyleSheet\.create\(\{/);
        if (styleSheetMatch && /StyleSheet\.create\(\{[\s\S]*colors\./m.test(content)) {
            // We need to extract the styles block and convert it to a function
            // Find "const styles = StyleSheet.create({" and its closing
            const startIdx = content.indexOf('const styles = StyleSheet.create({');
            if (startIdx >= 0) {
                // Find the matching closing "})"
                let depth = 0;
                let endIdx = startIdx;
                let foundStart = false;
                for (let i = startIdx; i < content.length; i++) {
                    if (content[i] === '{') { depth++; foundStart = true; }
                    if (content[i] === '}') { depth--; }
                    if (foundStart && depth === 0) {
                        // Find the closing ");"
                        endIdx = content.indexOf(');', i);
                        if (endIdx >= 0) endIdx += 2;
                        else endIdx = i + 1;
                        break;
                    }
                }

                const stylesBlock = content.substring(startIdx, endIdx);

                // Replace "const styles = StyleSheet.create({" with a function
                const newStylesBlock = stylesBlock
                    .replace('const styles = StyleSheet.create({', 'const createStyles = (colors) => StyleSheet.create({');

                content = content.substring(0, startIdx) + newStylesBlock + content.substring(endIdx);

                // Add "const styles = createStyles(colors);" after the useTheme() call
                const useThemeIdx = content.indexOf('const { colors } = useTheme();');
                if (useThemeIdx >= 0) {
                    const insertPoint = useThemeIdx + 'const { colors } = useTheme();'.length;
                    content = content.substring(0, insertPoint) + '\n  const styles = createStyles(colors);' + content.substring(insertPoint);
                }
            }
        }

        fs.writeFileSync(filePath, content, 'utf8');
        updated++;
        console.log(`✅ Updated: ${file}`);
    } else {
        skipped++;
    }
}

console.log(`\n📊 Results: ${updated} updated, ${skipped} skipped, ${files.length} total`);
