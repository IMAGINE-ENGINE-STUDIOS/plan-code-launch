import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Globe, Lock, CheckCircle2, AlertCircle, ExternalLink, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const PublishPage = () => {
  const { id: projectId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [customDomain, setCustomDomain] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load project data
  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('*').eq('id', projectId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const isPublished = project?.status === 'published';
  const publishedUrl = project?.published_url || `https://${project?.name?.toLowerCase().replace(/[^a-z0-9]/g, '-') || 'app'}-${projectId?.slice(0, 8)}.imagineengine.app`;
  const savedDomain = project?.custom_domain || '';
  const hasCustomDomain = !!savedDomain;

  useEffect(() => {
    if (savedDomain && !customDomain) setCustomDomain(savedDomain);
  }, [savedDomain]);

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const { error } = await supabase.from('projects').update({
        status: 'published',
        published_url: publishedUrl,
      }).eq('id', projectId!);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast({ title: 'Published!', description: `Your app is live at ${publishedUrl}` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: 'Copied!', description: 'URL copied to clipboard' });
  };

  const handleSaveDomain = async () => {
    if (!customDomain.trim()) return;
    setVerifying(true);
    try {
      const { error } = await supabase.from('projects').update({
        custom_domain: customDomain.trim(),
      }).eq('id', projectId!);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['project', projectId] });
      toast({ title: 'Domain saved', description: `${customDomain} has been configured. Set up DNS records below.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      {/* Subdomain */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-5 w-5 text-primary" />
          <h3 className="font-display font-semibold">Platform URL</h3>
        </div>
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm font-mono">
          <span className="text-foreground truncate">{publishedUrl}</span>
          {isPublished && <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-[hsl(var(--success))]" />}
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Button size="sm" onClick={handlePublish} disabled={publishing || isPublished}>
            {publishing ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Publishing…</>
            ) : isPublished ? (
              <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Published</>
            ) : (
              <><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Publish Now</>
            )}
          </Button>
          {isPublished && (
            <Button size="sm" variant="outline" onClick={handleCopyUrl}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy URL'}
            </Button>
          )}
        </div>
        {isPublished && (
          <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline">
            {publishedUrl} <ExternalLink className="h-3 w-3" />
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
            <Input value={customDomain} onChange={e => setCustomDomain(e.target.value)} placeholder="app.yourdomain.com" />
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
              <span className="text-muted-foreground">Status:</span>
              {hasCustomDomain ? (
                <span className="inline-flex items-center gap-1 text-[hsl(var(--success))]">
                  <CheckCircle2 className="h-3 w-3" />Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[hsl(var(--warning))]">
                  <AlertCircle className="h-3 w-3" />Not set
                </span>
              )}
            </div>
          </div>

          <Button size="sm" onClick={handleSaveDomain} disabled={!customDomain.trim() || verifying}>
            {verifying ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving…</>
            ) : (
              'Save Domain'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublishPage;
