import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  hint?: string
  required?: boolean
  hideLabel?: boolean
}

export const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaFieldProps>(function TextAreaField(
  { label, error, hint, id, className, required, hideLabel, rows = 5, ...rest },
  ref,
) {
  const generatedId = useId()
  const areaId = id ?? generatedId
  const errorId = `${areaId}-error`
  const hintId = `${areaId}-hint`
  return (
    <div>
      <label htmlFor={areaId} className={cn('field-label', hideLabel && 'sr-only')}>
        {label}
        {required && (
          <span aria-hidden="true" className="text-red-600 dark:text-red-400">
            {' '}
            *
          </span>
        )}
      </label>
      <textarea
        ref={ref}
        id={areaId}
        rows={rows}
        className={cn('field-input resize-y', className)}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        {...rest}
      />
      {hint && !error && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field-error">
          {error}
        </p>
      )}
    </div>
  )
})
