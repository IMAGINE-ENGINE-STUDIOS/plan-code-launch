import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, Code2, BarChart3, Rocket, GitBranch, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Navbar from '@/components/Navbar';
import heroBg from '@/assets/hero-bg.jpg';

const features = [
  { icon: Sparkles, title: 'Plan Mode', desc: 'AI generates structured app plans from your idea in seconds.' },
  { icon: Code2, title: 'Edit Mode', desc: 'AI applies scoped diffs and patches — no full rewrites.' },
  { icon: BarChart3, title: 'Analysis Mode', desc: 'Architecture, cost, performance, and security insights.' },
  { icon: Rocket, title: 'One-Click Deploy', desc: 'Publish to subdomain or connect your custom domain.' },
  { icon: GitBranch, title: 'Import & Migrate', desc: 'Bring GitHub repos or existing codebases with compatibility reports.' },
  { icon: Shield, title: 'Production-Ready', desc: 'Auth, RLS, secrets management, and team roles built in.' },
];

const fade = (delay: number) => ({
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, delay },
});

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />

    {/* Hero */}
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroBg} alt="" className="h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/80 to-background" />
      </div>
      <div className="container relative z-10 flex flex-col items-center py-24 text-center md:py-36">
        <motion.div {...fade(0)} className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
          <Zap className="h-3.5 w-3.5" /> AI-Powered App Builder
        </motion.div>
        <motion.h1 {...fade(0.1)} className="font-display text-4xl font-bold leading-tight md:text-6xl lg:text-7xl">
          Build apps at the
          <br />
          <span className="gradient-text">speed of thought</span>
        </motion.h1>
        <motion.p {...fade(0.2)} className="mt-6 max-w-xl text-lg text-muted-foreground">
          From idea to production in minutes. Plan with AI, edit with diffs, analyze for quality, and deploy instantly.
        </motion.p>
        <motion.div {...fade(0.3)} className="mt-8 flex gap-3">
          <Button size="lg" asChild>
            <Link to="/new-project">Start Building</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/dashboard">View Demo</Link>
          </Button>
        </motion.div>
      </div>
    </section>

    {/* Features */}
    <section className="container py-24">
      <motion.h2 {...fade(0)} viewport={{ once: true }} whileInView={{ opacity: 1, y: 0 }} className="mb-12 text-center font-display text-3xl font-bold">
        Everything you need to ship
      </motion.h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="group rounded-lg border border-border bg-card p-6 transition-all hover:border-primary/40 hover:glow"
          >
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="mb-2 font-display font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>

    {/* CTA */}
    <section className="container pb-24">
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-12 text-center">
        <h2 className="font-display text-3xl font-bold">Ready to build?</h2>
        <p className="mt-3 text-muted-foreground">4 questions. That's all it takes to get your plan.</p>
        <Button size="lg" className="mt-6" asChild>
          <Link to="/new-project">Start Your Project</Link>
        </Button>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>© 2026 BuildStack. Built with AI.</p>
    </footer>
  </div>
);

export default Index;
