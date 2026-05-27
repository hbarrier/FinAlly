'use client'

import { useEffect } from 'react'
import { bootstrapInstances } from '@/lib/actions/recurring-instances'

let bootstrapped = false

export function RecurringInstancesBootstrap() {
  useEffect(() => {
    if (bootstrapped) return
    bootstrapped = true
    bootstrapInstances()
  }, [])
  return null
}
