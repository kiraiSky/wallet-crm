'use client'

import * as Icons from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Mapa de ícones suportados (limitamos pra reduzir bundle size)
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  banknote: Icons.Banknote,
  landmark: Icons.Landmark,
  smartphone: Icons.Smartphone,
  'credit-card': Icons.CreditCard,
  wrench: Icons.Wrench,
  package: Icons.Package,
  'package-2': Icons.Package2,
  car: Icons.Car,
  'circle-dot': Icons.CircleDot,
  zap: Icons.Zap,
  droplet: Icons.Droplet,
  home: Icons.Home,
  phone: Icons.Phone,
  users: Icons.Users,
  fuel: Icons.Fuel,
  'shopping-bag': Icons.ShoppingBag,
  hammer: Icons.Hammer,
  settings: Icons.Settings,
  briefcase: Icons.Briefcase,
  'more-horizontal': Icons.MoreHorizontal,
}

export function DynamicIcon({
  name,
  ...props
}: { name: string } & LucideProps) {
  const Icon = iconMap[name] || Icons.HelpCircle
  return <Icon {...props} />
}

export const ICON_OPTIONS = Object.keys(iconMap)
