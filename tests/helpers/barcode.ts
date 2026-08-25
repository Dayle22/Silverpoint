import type { BarcodePlan, BarcodeVectorChildPlan } from '@open-pencil/core'

export function vectorChild(plan: BarcodePlan, role: 'modules' | 'background'): BarcodeVectorChildPlan {
  const child = plan.children.find((c) => c.role === role)
  if (!child || child.role === 'text') {
    throw new Error(`plan is missing a ${role} vector child`)
  }
  return child
}
