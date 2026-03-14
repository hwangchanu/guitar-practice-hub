import { useMemo, useCallback } from 'react';
import type { TabData } from '../types';

interface TabRendererProps {
  tabData: TabData;
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const NOTES_PER_LINE = 32;

function formatTabToText(tabData: TabData): string {
  const { notes, tuning } = tabData;
  if (notes.length === 0) return tuning.map((t) => `${t}|`).join('\n');

  const sorted = [...notes].sort((a, b) => a.time - b.time);
  const lines: string[] = [];

  for (let offset = 0; offset < sorted.length; offset += NOTES_PER_LINE) {
    const chunk = sorted.slice(offset, offset + NOTES_PER_LINE);
    // 6 strings, string 1 = high E (index 0), string 6 = low E (index 5)
    const rows: string[][] = Array.from({ length: 6 }, () => []);

    for (const note of chunk) {
      const fretStr = String(note.fret);
      const padLen = fretStr.length;
      for (let s = 0; s < 6; s++) {
        if (s === note.string - 1) {
          rows[s].push(fretStr);
        } else {
          rows[s].push('-'.repeat(padLen));
        }
      }
      // separator
      for (let s = 0; s < 6; s++) rows[s].push('-');
    }

    for (let s = 0; s < 6; s++) {
      lines.push(`${STRING_LABELS[s]}|${rows[s].join('')}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function TabRenderer({ tabData }: TabRendererProps) {
  const textTab = useMemo(() => formatTabToText(tabData), [tabData]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([textTab], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tab.txt';
    a.click();
    URL.revokeObjectURL(url);
  }, [textTab]);

  if (tabData.notes.length === 0) {
    return <p style={{ padding: 16, color: '#888' }}>표시할 타브 악보가 없습니다.</p>;
  }

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <p style={{ fontWeight: 600, margin: 0 }}>타브 악보</p>
        <button
          onClick={handleDownload}
          style={{
            padding: '6px 14px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: 'transparent',
            cursor: 'pointer',
            fontSize: 13,
          }}
          aria-label="타브 악보 텍스트 파일 다운로드"
        >
          텍스트 다운로드
        </button>
      </div>

      <pre
        style={{
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 14,
          lineHeight: 1.4,
          background: '#f8f8f8',
          padding: 16,
          borderRadius: 6,
          overflowX: 'auto',
          margin: 0,
        }}
        aria-label="타브 악보"
      >
        {textTab}
      </pre>
    </div>
  );
}
