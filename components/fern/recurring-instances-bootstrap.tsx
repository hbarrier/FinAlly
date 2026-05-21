'use client'

import { useEffect } from 'react'
import { bootstrapInstances } from '@/lib/actions/recurring-instances'

export function RecurringInstancesBootstrap() {
  useEffect(() => {
    bootstrapInstances()
  }, [])
  return null
}
