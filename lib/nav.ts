import {
  Activity,
  ArrowLeftRight,
  Compass,
  Droplets,
  Images,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  Store,
  ListChecks,
  SwatchBook,
  Wallet,
  Coins,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/launch", label: "Guided launch", icon: ListChecks },
  { href: "/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/explore", label: "Explore", icon: Compass },
  { href: "/token-launchpad", label: "Token Launchpad", icon: Coins },
  { href: "/nft-launchpad", label: "NFT Launchpad", icon: Images },
  { href: "/swap", label: "Swap", icon: ArrowLeftRight },
  { href: "/liquidity", label: "Liquidity", icon: Droplets },
  { href: "/market", label: "NFT Marketplace", icon: Store },
  { href: "/run", label: "Testnet run", icon: ListChecks },
  { href: "/studio", label: "Creator Studio", icon: SwatchBook },
  { href: "/portfolio", label: "Portfolio", icon: Wallet },
  { href: "/treasury", label: "Treasury", icon: Landmark },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
