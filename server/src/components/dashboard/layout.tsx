'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Home,
  CreditCard,
  Smartphone,
  Package,
  Users,
  Settings,
  HelpCircle,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Overview', href: '/dashboard', icon: Home },
  { name: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  { name: 'Devices', href: '/dashboard/devices', icon: Smartphone },
  { name: 'Plugins', href: '/dashboard/plugins', icon: Package },
  { name: 'Team', href: '/dashboard/team', icon: Users },
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 z-50 flex w-72 flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 shadow-sm">
          <div className="flex h-16 shrink-0 items-center">
            <Link href="/dashboard" className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Flow Desk</h1>
            </Link>
          </div>

          {/* Organization Switcher */}
          <div className="flex items-center gap-x-4">
            <OrganizationSwitcher
              hidePersonal={false}
              afterCreateOrganizationUrl="/dashboard"
              afterSelectOrganizationUrl="/dashboard"
              afterLeaveOrganizationUrl="/dashboard"
              organizationProfileUrl="/dashboard/settings/organization"
            />
          </div>

          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={cn(
                            isActive
                              ? 'bg-gray-50 text-indigo-600'
                              : 'text-gray-700 hover:bg-gray-50 hover:text-indigo-600',
                            'group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6'
                          )}
                        >
                          <item.icon
                            className={cn(
                              isActive
                                ? 'text-indigo-600'
                                : 'text-gray-400 group-hover:text-indigo-600',
                              'h-6 w-6 shrink-0'
                            )}
                            aria-hidden="true"
                          />
                          {item.name}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
              <li className="mt-auto">
                <div className="flex items-center gap-x-4 px-6 py-3 text-sm font-semibold leading-6 text-gray-900">
                  <UserButton
                    afterSignOutUrl="/"
                    userProfileUrl="/dashboard/settings/profile"
                  />
                </div>
                <Link
                  href="/help"
                  className="group -mx-2 flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 text-gray-700 hover:bg-gray-50 hover:text-indigo-600"
                >
                  <HelpCircle
                    className="h-6 w-6 shrink-0 text-gray-400 group-hover:text-indigo-600"
                    aria-hidden="true"
                  />
                  Help & Support
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </div>

      {/* Main content */}
      <div className="pl-72">
        <main className="py-10">
          <div className="px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}