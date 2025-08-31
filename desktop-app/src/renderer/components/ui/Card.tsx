import React, { forwardRef, type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './utils'
import { type BaseComponentProps } from './types'

const cardVariants = cva(
  [
    'rounded-lg border bg-card text-card-foreground',
    'transition-all duration-150 ease-out'
  ],
  {
    variants: {
      variant: {
        default: 'shadow-sm',
        elevated: 'shadow-md hover:shadow-lg',
        outlined: 'shadow-none border-2',
        ghost: 'shadow-none border-none bg-transparent'
      },
      padding: {
        none: 'p-0',
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8'
      },
      interactive: {
        true: 'cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-flow-primary-500 focus:ring-offset-2'
      }
    },
    defaultVariants: {
      variant: 'default',
      padding: 'md'
    }
  }
)

export interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants>,
    BaseComponentProps {
  interactive?: boolean
  as?: 'div' | 'section' | 'article' | 'aside'
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({
    className,
    variant,
    padding,
    interactive = false,
    as: Component = 'div',
    'data-testid': testId,
    ...props
  }, ref) => {
    return (
      <Component
        className={cn(cardVariants({ variant, padding, interactive }), className)}
        ref={ref}
        data-testid={testId}
        tabIndex={interactive ? 0 : undefined}
        role={interactive ? 'button' : undefined}
        {...props}
      />
    )
  }
)

Card.displayName = 'Card'

const CardHeader = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & BaseComponentProps>(
  ({ className, 'data-testid': testId, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex flex-col space-y-1.5', className)}
      data-testid={testId}
      {...props}
    />
  )
)
CardHeader.displayName = 'CardHeader'

const CardTitle = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLHeadingElement> & BaseComponentProps>(
  ({ className, 'data-testid': testId, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-semibold leading-none tracking-tight text-lg', className)}
      data-testid={testId}
      {...props}
    />
  )
)
CardTitle.displayName = 'CardTitle'

const CardDescription = forwardRef<HTMLParagraphElement, HTMLAttributes<HTMLParagraphElement> & BaseComponentProps>(
  ({ className, 'data-testid': testId, ...props }, ref) => (
    <p
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      data-testid={testId}
      {...props}
    />
  )
)
CardDescription.displayName = 'CardDescription'

const CardContent = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & BaseComponentProps>(
  ({ className, 'data-testid': testId, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex-1', className)}
      data-testid={testId}
      {...props}
    />
  )
)
CardContent.displayName = 'CardContent'

const CardFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & BaseComponentProps>(
  ({ className, 'data-testid': testId, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center pt-4', className)}
      data-testid={testId}
      {...props}
    />
  )
)
CardFooter.displayName = 'CardFooter'

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  cardVariants
}