'use client';

import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';

export const OUTPUT_FILENAME_EXTENSION = '.%(ext)s';

export const stripOutputFilenameExtension = (value: string) =>
  value.endsWith(OUTPUT_FILENAME_EXTENSION)
    ? value.slice(0, -OUTPUT_FILENAME_EXTENSION.length)
    : value;

export const appendOutputFilenameExtension = (value: string) =>
  value.endsWith(OUTPUT_FILENAME_EXTENSION) ? value : `${value}${OUTPUT_FILENAME_EXTENSION}`;

const OUTPUT_FILENAME_TOKENS = [
  { value: '%(title)s', label: 'Title', description: 'Video title' },
  { value: '%(id)s', label: 'ID', description: 'Video ID' },
  { value: '%(uploader)s', label: 'Uploader', description: 'Uploader name' },
  { value: '%(channel)s', label: 'Channel', description: 'Channel name' },
  { value: '%(upload_date)s', label: 'Upload Date', description: 'YYYYMMDD' },
  { value: '%(playlist_index)s', label: 'Playlist Index', description: 'Playlist order' },
  { value: '%(playlist_title)s', label: 'Playlist Title', description: 'Playlist name' },
  { value: '%(duration)s', label: 'Duration', description: 'Seconds' }
] as const;

const OUTPUT_FILENAME_TOKEN_MAP = new Map(
  OUTPUT_FILENAME_TOKENS.map((token) => [token.value, token])
);
const outputFilenameTokenRegex = new RegExp(
  `(${OUTPUT_FILENAME_TOKENS.map((token) =>
    token.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  ).join('|')})`,
  'g'
);

type OutputFilenameToken = (typeof OUTPUT_FILENAME_TOKENS)[number];
type OutputFilenamePart =
  | { type: 'text'; value: string }
  | { type: 'token'; value: OutputFilenameToken['value'] };
type OutputFilenameEditorHandle = {
  insertToken: (tokenValue: OutputFilenameToken['value']) => void;
};

const parseOutputFilename = (value: string): OutputFilenamePart[] => {
  const parts: OutputFilenamePart[] = [];
  let lastIndex = 0;

  for (const match of value.matchAll(outputFilenameTokenRegex)) {
    const index = match.index ?? 0;
    parts.push({ type: 'text', value: value.slice(lastIndex, index) });
    parts.push({ type: 'token', value: match[0] as OutputFilenameToken['value'] });
    lastIndex = index + match[0].length;
  }

  parts.push({ type: 'text', value: value.slice(lastIndex) });
  return parts.length > 0 ? parts : [{ type: 'text', value: '' }];
};

const serializeOutputFilename = (parts: OutputFilenamePart[]) =>
  parts.map((part) => part.value).join('');

const OutputFilenameEditor = forwardRef<
  OutputFilenameEditorHandle,
  {
    value: string;
    disabled?: boolean;
    onChange: (value: string) => void;
  }
>(function OutputFilenameEditor({ value, disabled = false, onChange }, ref) {
  const parts = parseOutputFilename(value);
  const [activeTextIndex, setActiveTextIndex] = useState<number | null>(null);
  const [caretPosition, setCaretPosition] = useState(0);
  const inputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const textMeasureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const updateCaretPosition = (index: number, element: HTMLInputElement) => {
    setActiveTextIndex(index);
    setCaretPosition(element.selectionStart ?? element.value.length);
  };

  const focusTextInputAt = (index: number, position: number) => {
    window.requestAnimationFrame(() => {
      const input = inputRefs.current[index];
      if (!input) return;

      const nextCaretPosition = Math.min(position, input.value.length);
      input.focus();
      input.setSelectionRange(nextCaretPosition, nextCaretPosition);
      updateCaretPosition(index, input);
    });
  };

  const focusTextInput = (index: number, position: 'start' | 'end') => {
    const input = inputRefs.current[index];
    focusTextInputAt(index, position === 'start' ? 0 : input?.value.length ?? 0);
  };

  const focusEditorEnd = () => {
    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (parts[index].type === 'text') {
        focusTextInput(index, 'end');
        return;
      }
    }
  };

  const updateTextPart = (index: number, nextValue: string) => {
    const nextParts = [...parts];
    nextParts[index] = { type: 'text', value: nextValue };
    onChange(serializeOutputFilename(nextParts));
  };

  const getTextPartWidth = (part: Extract<OutputFilenamePart, { type: 'text' }>, index: number) => {
    if (!part.value) {
      return index === 0 && !value ? '150px' : '1px';
    }

    if (typeof document === 'undefined') {
      return `${Math.max(part.value.length, 1)}ch`;
    }

    if (!textMeasureCanvasRef.current) {
      textMeasureCanvasRef.current = document.createElement('canvas');
    }

    const context = textMeasureCanvasRef.current.getContext('2d');
    const input = inputRefs.current[index];
    if (!context || !input) {
      return `${Math.max(part.value.length, 1)}ch`;
    }

    context.font = window.getComputedStyle(input).font;
    return `${Math.ceil(context.measureText(part.value).width)}px`;
  };

  const insertToken = (tokenValue: OutputFilenameToken['value']) => {
    const nextParts = [...parseOutputFilename(value)];

    if (activeTextIndex !== null && nextParts[activeTextIndex]?.type === 'text') {
      const activePart = nextParts[activeTextIndex];
      const insertAt = Math.min(caretPosition, activePart.value.length);
      nextParts.splice(
        activeTextIndex,
        1,
        { type: 'text', value: activePart.value.slice(0, insertAt) },
        { type: 'token', value: tokenValue },
        { type: 'text', value: activePart.value.slice(insertAt) }
      );
      onChange(serializeOutputFilename(nextParts));
      focusTextInput(activeTextIndex + 2, 'start');
      return;
    }

    nextParts.push({ type: 'token', value: tokenValue }, { type: 'text', value: '' });
    onChange(serializeOutputFilename(nextParts));
    focusTextInput(nextParts.length - 1, 'start');
  };

  const removeToken = (index: number) => {
    const nextParts = parts.filter((_, partIndex) => partIndex !== index);
    onChange(serializeOutputFilename(nextParts));
  };

  const handleTextKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? 0;
    const hasSelection = selectionStart !== selectionEnd;

    if (event.key === 'Backspace' && !hasSelection && selectionStart === 0) {
      const previousPartIndex = index - 1;
      if (parts[previousPartIndex]?.type === 'token') {
        event.preventDefault();
        const previousText = parts[index - 2]?.type === 'text' ? parts[index - 2].value : '';
        removeToken(previousPartIndex);
        focusTextInputAt(Math.max(index - 2, 0), previousText.length);
      }
    }

    if (event.key === 'Delete' && !hasSelection && selectionStart === input.value.length) {
      const nextPartIndex = index + 1;
      if (parts[nextPartIndex]?.type === 'token') {
        event.preventDefault();
        removeToken(nextPartIndex);
        focusTextInputAt(index, input.value.length);
      }
    }

    if (event.key === 'ArrowLeft' && !hasSelection && selectionStart === 0) {
      const previousTextIndex = index - 2;
      if (parts[index - 1]?.type === 'token' && parts[previousTextIndex]?.type === 'text') {
        event.preventDefault();
        focusTextInput(previousTextIndex, 'end');
      }
    }

    if (event.key === 'ArrowRight' && !hasSelection && selectionStart === input.value.length) {
      const nextTextIndex = index + 2;
      if (parts[index + 1]?.type === 'token' && parts[nextTextIndex]?.type === 'text') {
        event.preventDefault();
        focusTextInput(nextTextIndex, 'start');
      }
    }
  };

  useImperativeHandle(ref, () => ({ insertToken }));

  return (
    <div
      className='flex min-h-[34px] w-full min-w-0 flex-1 cursor-text items-center rounded-md border border-input bg-background px-1.5 py-1 text-left focus-within:ring-1 focus-within:ring-ring'
      onClick={(event) => {
        if (!disabled && event.target === event.currentTarget) focusEditorEnd();
      }}
    >
      <div
        className='flex min-w-0 flex-1 flex-wrap content-start items-center justify-start gap-px text-left'
        onClick={(event) => {
          if (!disabled && event.target === event.currentTarget) focusEditorEnd();
        }}
      >
        {parts.map((part, index) => {
          if (part.type === 'token') {
            const token = OUTPUT_FILENAME_TOKEN_MAP.get(part.value);
            return (
              <button
                key={`${part.value}-${index}`}
                type='button'
                className='inline-flex h-6 shrink-0 cursor-text select-none items-center rounded-md border border-primary/20 bg-primary/10 px-2.5 text-sm font-medium leading-none text-primary'
                title={`Place cursor after ${token?.label || part.value}`}
                disabled={disabled}
                onClick={() => focusTextInput(index + 1, 'start')}
              >
                {token?.label || part.value}
              </button>
            );
          }

          return (
            <input
              key={`text-${index}`}
              ref={(element) => {
                inputRefs.current[index] = element;
              }}
              className='h-7 min-w-0 bg-transparent px-0 text-sm caret-primary outline-none disabled:cursor-not-allowed disabled:opacity-50'
              style={{ width: getTextPartWidth(part, index) }}
              value={part.value}
              disabled={disabled}
              placeholder={index === 0 && !value ? 'Tap + to add filename variables' : ''}
              onKeyDown={(event) => handleTextKeyDown(index, event)}
              onChange={(event) => updateTextPart(index, event.target.value)}
              onFocus={(event) => updateCaretPosition(index, event.currentTarget)}
              onClick={(event) => updateCaretPosition(index, event.currentTarget)}
              onKeyUp={(event) => updateCaretPosition(index, event.currentTarget)}
              onSelect={(event) => updateCaretPosition(index, event.currentTarget)}
            />
          );
        })}
      </div>
    </div>
  );
});

export function OutputFilenameEditorField({
  value,
  disabled = false,
  onChange
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<OutputFilenameEditorHandle>(null);

  return (
    <div className='flex min-w-0 basis-[320px] flex-1 items-start gap-x-1'>
      <OutputFilenameEditor ref={editorRef} value={value} disabled={disabled} onChange={onChange} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type='button'
            className='h-[34px] w-[34px] shrink-0 rounded-full border border-primary/30 bg-primary/90 px-0 py-0 text-primary-foreground shadow-sm hover:bg-primary'
            disabled={disabled}
            title='Add filename variable'
          >
            <Plus className='h-4 w-4' />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align='end' className='w-64'>
          <DropdownMenuLabel>Filename variables</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OUTPUT_FILENAME_TOKENS.map((token) => (
            <DropdownMenuItem
              key={token.value}
              className='cursor-pointer items-start gap-x-2'
              onClick={() => editorRef.current?.insertToken(token.value)}
            >
              <span className='min-w-[112px] text-sm'>{token.label}</span>
              <span className='flex flex-col text-xs text-muted-foreground'>
                <span>{token.value}</span>
                {token.description ? <span>{token.description}</span> : null}
              </span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel className='text-xs font-normal text-muted-foreground'>
            Extension is automatically appended as .%(ext)s.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
