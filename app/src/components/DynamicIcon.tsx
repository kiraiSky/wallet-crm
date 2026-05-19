'use client'

import * as Icons from 'lucide-react'
import { LucideProps } from 'lucide-react'

// Mapa de ícones suportados (limitamos pra reduzir bundle size)
const iconMap: Record<string, React.ComponentType<LucideProps>> = {
  // Contas
  banknote: Icons.Banknote,
  landmark: Icons.Landmark,
  wallet: Icons.Wallet,
  'credit-card': Icons.CreditCard,
  // Oficina mecânica
  wrench: Icons.Wrench,
  hammer: Icons.Hammer,
  package: Icons.Package,
  'package-2': Icons.Package2,
  users: Icons.Users,
  user: Icons.User,
  'user-plus': Icons.UserPlus,
  fuel: Icons.Fuel,
  car: Icons.Car,
  'car-front': Icons.CarFront,
  'circle-dot': Icons.CircleDot,
  cog: Icons.Cog,
  activity: Icons.Activity,
  'clipboard-check': Icons.ClipboardCheck,
  mail: Icons.Mail,
  'map-pin': Icons.MapPin,
  cake: Icons.Cake,
  'phone-call': Icons.PhoneCall,
  // Casa / utilities
  home: Icons.Home,
  zap: Icons.Zap,
  droplet: Icons.Droplet,
  droplets: Icons.Droplets,
  phone: Icons.Phone,
  // Negócio
  megaphone: Icons.Megaphone,
  shield: Icons.Shield,
  receipt: Icons.Receipt,
  briefcase: Icons.Briefcase,
  'trending-up': Icons.TrendingUp,
  'shopping-bag': Icons.ShoppingBag,
  settings: Icons.Settings,
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
