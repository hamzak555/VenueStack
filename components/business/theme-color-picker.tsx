'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Paintbrush } from 'lucide-react'

interface ThemeColorPickerProps {
  value: string
  onChange: (color: string) => void
  disabled?: boolean
}

const PRESET_COLORS = [
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
]

export function ThemeColorPicker({ value, onChange, disabled }: ThemeColorPickerProps) {
  const [open, setOpen] = useState(false)
  const [hexInput, setHexInput] = useState(value)

  const handleHexChange = (hex: string) => {
    setHexInput(hex)
    // Validate hex color format
    if (/^#[0-9A-F]{6}$/i.test(hex)) {
      onChange(hex)
    }
  }

  const handleColorSelect = (color: string) => {
    onChange(color)
    setHexInput(color)
  }

  return (
    <div className="space-y-2">
      <Label>Theme Color</Label>
      <p className="text-xs text-muted-foreground mb-3">
        Choose a color that represents your brand.
      </p>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            disabled={disabled}
            className="w-full justify-start gap-3 h-auto py-3"
          >
            <div
              className="h-10 w-10 rounded-md border-2 border-white/20 shadow-lg"
              style={{ backgroundColor: value }}
            />
            <div className="flex flex-col items-start flex-1">
              <span className="text-xs text-muted-foreground">Selected Color</span>
              <span className="font-mono text-sm font-medium">{value.toUpperCase()}</span>
            </div>
            <Paintbrush className="h-4 w-4 ml-auto text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-sm mb-3">Preset Colors</h4>
              <div className="grid grid-cols-8 gap-3">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => handleColorSelect(color.value)}
                    className={`
                      relative h-7 w-7 rounded-md transition-all
                      ${value === color.value ? 'ring-2 ring-white ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105'}
                    `}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  >
                    {value === color.value && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <svg
                          className="h-3 w-3 text-white drop-shadow-lg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium text-sm mb-3">Custom Color</h4>
              <div className="flex items-stretch gap-2">
                <div className="relative w-16 rounded-md overflow-hidden border border-input">
                  <input
                    type="color"
                    value={value}
                    onChange={(e) => handleColorSelect(e.target.value)}
                    className="absolute inset-0 w-full h-full cursor-pointer rounded-md"
                  />
                </div>
                <Input
                  type="text"
                  value={hexInput}
                  onChange={(e) => handleHexChange(e.target.value.toUpperCase())}
                  placeholder="#3B82F6"
                  maxLength={7}
                  className="flex-1 font-mono"
                />
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
