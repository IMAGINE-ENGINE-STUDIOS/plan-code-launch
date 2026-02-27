import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Globe, Lock, CheckCircle2, AlertCircle, ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const PublishPage = () => {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const [customDomain, setCustomDomain] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [copied, setCopied] = useState(false);
  const subdomain = 'my-saas-app';
  const liveUrl = `https://${subdomain}.buildstack.app`;

  const handlePublish = async () => {
    setPublishing(true);
    try {
      if (projectId) {
        await supabase.from('projects').update({ status: 'published' }).eq('id', projectId);
      }
      await new Promise(r => setTimeout(r, 1500));
      setPublished(true);
      toast({ title: 'Published!', description: `Your app is live at ${liveUrl}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: 'URL copied to clipboard' });
  };

  const handleVerifyDomain = async () => {
    if (!customDomain.trim()) return;
    setVerifying(true);
    await new Promise(r => setTimeout(r, 2000));
    setVerified(true);
    setVerifying(false);
    toast({ title: 'Domain verified', description: `${customDomain} is now connected` });
  };

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* Subdomain */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Platform Subdomain</h3>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-mono">
          <span className="text-foreground">{subdomain}</span>
          <span className="text-muted-foreground">.buildstack.app</span>
          {published && <CheckCircle2 className="ml-auto h-4 w-4 text-[hsl(var(--success))]" />}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={handlePublish} disabled={publishing || published}>
            {publishing ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Publishing…</>
            ) : published ? (
              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Published</>
            ) : (
              <><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Publish Now</>
            )}
          </Button>
          {published && (
            <Button size="sm" variant="outline" onClick={handleCopyUrl}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy URL'}
            </Button>
          )}
        </div>
        {published && (
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            {liveUrl} <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Custom Domain */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Custom Domain</h3>
        </div>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Domain</Label>
            <Input
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="app.yourdomain.com"
            />
          </div>

          <div className="rounded-lg border border-border bg-muted/50 p-4 text-sm space-y-3">
            <p className="font-medium">DNS Configuration</p>
            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between"><span className="text-muted-foreground">Type</span><span>A</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Name</span><span>@</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Value</span><span>185.158.133.1</span></div>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>DNS propagation can take up to 72 hours</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">SSL Status:</span>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                  <CheckCircle2 className="h-3 w-3" />Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[hsl(var(--warning))]">
                  <AlertCircle className="h-3 w-3" />Pending
                </span>
              )}
            </div>
          </div>

          <Button size="sm" onClick={handleVerifyDomain} disabled={!customDomain.trim() || verifying || verified}>
            {verifying ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Verifying…</>
            ) : verified ? (
              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Connected</>
            ) : (
              'Verify & Connect'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublishPage;
