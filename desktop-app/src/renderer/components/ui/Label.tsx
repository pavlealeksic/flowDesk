import React from 'react'
import { cn } from './utils'

interface LabelProps {
  children: React.ReactNode
  className?: string
  htmlFor?: string
}

export const Label: React.FC<LabelProps> = ({ children, className, htmlFor }) => {
  return (
    <label 
      htmlFor={htmlFor} 
      className={cn('text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70', className)}
    >
      {children}
    </label>
  )
}

export default Label