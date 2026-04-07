import React, { useState, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'

export function CurrencyInput({ value, onChange, disabled, className, placeholder }: { 
  value: number, 
  onChange: (value: number) => void, 
  disabled?: boolean, 
  className?: string, 
  placeholder?: string 
}) {
  const displayValue = React.useMemo(() => {
    if (value !== undefined && value !== null) {
      return formatCurrency(value, true)
    }
    return ''
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '')
    if (!val) {
      onChange(0)
      return
    }
    const num = Number(val) / 100
    onChange(num)
  }

  return (
    <input
      type="text"
      className={className}
      value={displayValue}
      onChange={handleChange}
      disabled={disabled}
      placeholder={placeholder}
    />
  )
}
