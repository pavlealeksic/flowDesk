import React, { createContext, useContext, useState } from 'react'
import { cn } from './utils'

interface SelectContextType {
  value: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const SelectContext = createContext<SelectContextType | null>(null)

interface SelectProps {
  children: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export const Select: React.FC<SelectProps> = ({ 
  children, 
  value, 
  onValueChange, 
  disabled = false 
}) => {
  const [open, setOpen] = useState(false)

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className={cn("relative", disabled && "pointer-events-none opacity-50")}>
        {children}
      </div>
    </SelectContext.Provider>
  )
}

export const SelectTrigger: React.FC<{ 
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectTrigger must be used within Select')

  return (
    <button
      type="button"
      role="combobox"
      aria-expanded={context.open}
      onClick={() => context.setOpen(!context.open)}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background",
        "placeholder:text-muted-foreground",
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  )
}

export const SelectValue: React.FC<{ 
  placeholder?: string;
  className?: string;
}> = ({ placeholder }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectValue must be used within Select')

  return <span>{context.value || placeholder}</span>
}

export const SelectContent: React.FC<{ 
  children: React.ReactNode;
  className?: string;
}> = ({ children, className }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectContent must be used within Select')

  if (!context.open) return null

  return (
    <div
      className={cn(
        "absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover text-popover-foreground shadow-md",
        "animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectItem: React.FC<{ 
  children: React.ReactNode;
  value: string;
  key?: string;
  className?: string;
}> = ({ children, value, className }) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error('SelectItem must be used within Select')

  const handleSelect = () => {
    context.onValueChange(value)
    context.setOpen(false)
  }

  return (
    <div
      role="option"
      aria-selected={context.value === value}
      onClick={handleSelect}
      className={cn(
        "relative flex cursor-pointer items-center rounded-sm px-2 py-1.5 text-sm outline-none",
        "hover:bg-accent hover:text-accent-foreground",
        "focus:bg-accent focus:text-accent-foreground",
        context.value === value && "bg-accent text-accent-foreground",
        className
      )}
    >
      {children}
    </div>
  )
}