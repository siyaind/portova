"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowDownLeft, ArrowRight, ArrowUpRight, Check, ChevronRight, Coins, Command, Droplets, Fingerprint, Gem, Layers3, Menu, ShieldCheck, Sparkles, X } from "lucide-react";
import { Brand, BrandMark } from "@/components/brand";
import { useChain } from "@/components/chain/chain-provider";
import { NODE_CONSOLE } from "@/lib/network";

const MODULES = [
  { number: "01", title: "Make your first move.", name: "Token launchpad", text: "Turn an idea into a native asset. Set your supply, give it an identity, and make it yours.", href: "/token-launchpad", icon: Coins, art: "token" },
  { number: "02", title: "Create something collectible.", name: "NFT studio", text: "Give your collection a home. Create, mint, and shape the details of what comes next.", href: "/nft-launchpad", icon: Gem, art: "nft" },
  { number: "03", title: "Let possibilities flow.", name: "Swap & liquidity", text: "Bring assets together. Build a pool, provide liquidity, and trade with a live onchain quote.", href: "/liquidity", icon: Droplets, art: "liquidity" },
];

export function LandingPage() {
  const chain = useChain();
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [menuOpen]);

  return <div className="landing">
    <div className="landing-backdrop" aria-hidden="true" />
    <header className="landing-header"><div className="landing-container landing-header-inner">
      <Brand />
      <nav className="landing-desktop-nav" aria-label="Main navigation"><a href="#workspace">The workspace</a><a href="#how-it-works">How it works</a><Link href="/explore">Explore <ArrowUpRight size={13} /></Link></nav>
      <div className="landing-header-actions"><span className="testnet-label"><span /> V3 Testnet</span><Link href="/overview" className="landing-button button-small">Open app <ArrowUpRight size={16} /></Link><button className="landing-menu-button" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="landing-mobile-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button></div>
    </div>{menuOpen && <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Mobile navigation"><a href="#workspace" onClick={() => setMenuOpen(false)}>The workspace <ArrowRight size={16} /></a><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How it works <ArrowRight size={16} /></a><Link href="/explore" onClick={() => setMenuOpen(false)}>Explore assets <ArrowUpRight size={16} /></Link></nav>}</header>

    <main id="main">
      <section className="landing-container hero-section"><div className="hero-copy">
        <div className="hero-eyebrow rise"><span className="eyebrow-line" /> A NEW HOME FOR WHAT YOU CREATE</div>
        <h1 className="hero-title rise">Big ideas.<br />Real ownership.<br /><span>Endless possibility.</span></h1>
        <p className="hero-description rise">Create a token. Launch a collection. Bring it all together.<br className="desktop-break" /> Your onchain journey starts with Portova.</p>
        <div className="hero-actions rise"><Link href="/overview" className="landing-button">Enter the workspace <ArrowUpRight size={19} /></Link><a href="#workspace" className="hero-secondary">Discover what&apos;s possible <ArrowDown size={16} /></a></div>
        <div className="hero-assurance rise"><ShieldCheck size={15} /><span>Your wallet. Your assets. Always.</span><span className="assurance-divider" /><span>Built on Portaldot</span></div>
      </div><NetworkSculpture /><div className="hero-bottom-note"><span>CREATE. LAUNCH. TRADE. OWN.</span><a href="#workspace" aria-label="Scroll to the workspace"><ArrowDown size={16} /></a><span>ONE CONNECTED WORKSPACE</span></div></section>

      <div className="network-strip"><div className="landing-container network-strip-inner"><div className="network-strip-title"><span className={`live-dot ${chain.status === "live" ? "is-live" : ""}`} /><span>{chain.status === "live" ? "A living ecosystem." : chain.status === "connecting" ? "Connecting to the ecosystem." : "Explore the ecosystem."}<small>Direct from Portaldot V3 Testnet</small></span></div><NetworkStat value={chain.assets?.length ?? null} label="Native assets" /><NetworkStat value={chain.collectionCount} label="NFT collections" /><NetworkStat value={chain.poolCount} label="Liquidity pools" /><a className="network-explorer" href={NODE_CONSOLE} target="_blank" rel="noreferrer">Explore the network <ArrowUpRight size={17} /></a></div></div>

      <section id="workspace" className="landing-container workspace-section"><Reveal className="section-heading"><div><p className="section-eyebrow"><Sparkles size={14} /> MADE FOR YOUR NEXT CHAPTER</p><h2>From a spark.<br />To something <span>real.</span></h2></div><p>Everything you need to bring an idea onchain.<br />Connected by design. Yours at every step.</p></Reveal><div className="module-grid">{MODULES.map((module, index) => <Reveal key={module.name} delay={index * 90}><Link href={module.href} className={`module-card module-${module.art}`}><div className="module-top"><span><module.icon size={15} /> {module.name}</span><ArrowUpRight size={19} /></div><ModuleArtwork kind={module.art} /><div className="module-copy"><span className="module-number">/{module.number}</span><h3>{module.title}</h3><p>{module.text}</p><span className="module-link">Start creating <ArrowRight size={16} /></span></div></Link></Reveal>)}</div></section>

      <section className="workspace-feature-section"><div className="landing-container workspace-feature-grid"><Reveal className="workspace-preview"><div className="preview-top"><div><span /><span /><span /></div><span>YOUR CREATOR WORKSPACE</span><Command size={13} /></div><div className="preview-body"><div className="preview-project-icon"><Layers3 size={25} /></div><p className="preview-kicker">ONE PROJECT. EVERY CONNECTION.</p><h3>See the whole picture.</h3><p>Your token, collection, pool, and proceeds account.<br />One place to bring them together.</p><div className="preview-objects">{[{ icon: Coins, name: "Your token", label: "Create an identity", color: "purple" }, { icon: Gem, name: "Your collection", label: "Build your world", color: "peach" }, { icon: Droplets, name: "Your liquidity", label: "Make connections", color: "mint" }].map((item) => <div key={item.name}><span className={`preview-object-icon ${item.color}`}><item.icon size={17} /></span><span><strong>{item.name}</strong><small>{item.label}</small></span><ChevronRight size={15} /></div>)}</div></div><div className="preview-bottom"><Fingerprint size={15} /><span>Linked in your browser. Owned in your wallet.</span></div></Reveal><Reveal className="workspace-feature-copy" delay={100}><p className="section-eyebrow">THE BIG PICTURE, BEAUTIFULLY SIMPLE</p><h2>Many possibilities.<br /><span>One workspace.</span></h2><p>Keep your creative world connected. Creator Studio brings your onchain assets and project details into a single, focused view.</p><ul><li><Check size={16} /> Link your token, collection, and pool</li><li><Check size={16} /> See the state of each project stage</li><li><Check size={16} /> Keep control with your own wallet</li></ul><Link href="/studio" className="text-link">Meet Creator Studio <ArrowUpRight size={17} /></Link></Reveal></div></section>

      <section id="how-it-works" className="landing-container journey-section"><Reveal className="section-heading"><div><p className="section-eyebrow">LESS FRICTION. MORE CREATING.</p><h2>A small start.<br /><span>A world of potential.</span></h2></div><p>You bring the idea.<br />We bring the pieces together.</p></Reveal><div className="journey-grid">{[{ title: "Connect your wallet", text: "Bring a compatible Substrate wallet. Your keys stay with you.", icon: Fingerprint }, { title: "Create your first asset", text: "Launch a native token or give a new NFT collection its first chapter.", icon: Sparkles }, { title: "Find your flow", text: "Connect your project, create a pool, and explore what comes next.", icon: ArrowDownLeft }].map((step, index) => <Reveal key={step.title} delay={index * 90}><div className="journey-step"><div className="journey-step-top"><span>0{index + 1}</span><step.icon size={21} /></div><h3>{step.title}</h3><p>{step.text}</p></div></Reveal>)}</div></section>

      <section className="landing-container final-section"><Reveal><div className="final-card"><div className="final-orbit" aria-hidden="true"><span /><span /><span /></div><p className="section-eyebrow">YOUR NEXT CHAPTER IS ONCHAIN</p><h2>Let&apos;s make<br /><span>something matter.</span></h2><Link href="/overview" className="landing-button">Find your starting point <ArrowUpRight size={19} /></Link><p className="final-note">Explore on Portaldot V3 Testnet.</p></div></Reveal></section>
    </main>
    <footer className="landing-footer"><div className="landing-container"><div className="footer-main"><div><Brand /><p>A little spark. An onchain future.</p></div><nav aria-label="Footer navigation"><Link href="/explore">Explore</Link><Link href="/studio">Creator Studio</Link><Link href="/settings">Network details</Link><a href={NODE_CONSOLE} target="_blank" rel="noreferrer">Node console <ArrowUpRight size={13} /></a></nav></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Portova. Built for possibility.</span><span><span className="live-dot" /> Portaldot V3 Testnet <span className="footer-chain-id">420420777</span></span></div></div></footer>
  </div>;
}

function NetworkStat({ value, label }: { value: number | null; label: string }) {
  return <div className="network-stat"><strong>{value ?? "—"}<span>↗</span></strong><span>{label}</span></div>;
}

function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !window.IntersectionObserver) return;
    element.classList.add("reveal-pending");
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { element.classList.add("revealed"); observer.disconnect(); } }, { threshold: 0.1 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function NetworkSculpture() {
  return <div className="network-sculpture rise" role="img" aria-label="An animated orbital sculpture connecting tokens, collections, and liquidity around Portova"><div className="sculpture-grid" /><div className="sculpture-glow" /><div className="orbit-track orbit-track-one" /><div className="orbit-track orbit-track-two" /><div className="orbit-track orbit-track-three" /><div className="orbital-system"><div className="orbital-ring"><span /></div><div className="orbital-ring orbital-ring-alt"><span /></div></div><div className="sculpture-core"><div className="core-shine" /><BrandMark /><span className="core-caption">POSSIBILITY, CONNECTED</span></div><div className="orbit-node orbit-node-token"><div><Coins size={22} /></div><span>Native assets<small>Your idea, onchain.</small></span><span className="node-indicator" /></div><div className="orbit-node orbit-node-nft"><div><Gem size={22} /></div><span>Collections<small>Creativity, owned.</small></span><ArrowUpRight size={15} /></div><div className="orbit-node orbit-node-pool"><div><Droplets size={22} /></div><span>Liquidity<small>Let it flow.</small></span><span className="node-indicator" /></div><span className="sculpture-cross cross-one">+</span><span className="sculpture-cross cross-two">+</span><span className="sculpture-coordinate">P / V3.0</span><span className="sculpture-coordinate coordinate-bottom">AN OPEN WORLD AWAITS</span><div className="sculpture-small-orb orb-one" /><div className="sculpture-small-orb orb-two" /></div>;
}

function ModuleArtwork({ kind }: { kind: string }) {
  if (kind === "token") return <div className="module-art token-art" aria-hidden="true"><span className="token-orbit" /><div className="coin coin-back"><BrandMark /></div><div className="coin coin-front"><BrandMark /></div><span className="art-spark spark-one">+</span><span className="art-spark spark-two">+</span></div>;
  if (kind === "nft") return <div className="module-art nft-art" aria-hidden="true"><div className="nft-tile nft-tile-back"><span /></div><div className="nft-tile nft-tile-front"><div className="nft-flower">{Array.from({ length: 8 }, (_, i) => <span key={i} style={{ transform: `rotate(${i * 45}deg)` }} />)}</div><span className="nft-caption">A WORLD OF YOUR OWN</span></div></div>;
  return <div className="module-art liquidity-art" aria-hidden="true"><div className="liquidity-loop loop-one" /><div className="liquidity-loop loop-two" /><span className="liquidity-dot" /><span className="art-spark spark-two">+</span></div>;
}
