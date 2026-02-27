import { useState } from 'react';
import { Globe, Lock, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const PublishPage = () => {
  const [customDomain, setCustomDomain] = useState('');
  const subdomain = 'my-saas-app';

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
          <CheckCircle2 className="ml-auto h-4 w-4 text-success" />
        </div>
        <Button className="mt-4" size="sm">
          <ExternalLink className="mr-1.5 h-3.5 w-3.5" />Publish Now
        </Button>
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
              <span className="text-muted-foreground">SSL Status:</span>
              <span className="inline-flex items-center gap-1 text-warning"><AlertCircle className="h-3 w-3" />Pending</span>
            </div>
          </div>

          <Button size="sm" disabled={!customDomain}>Verify & Connect</Button>
        </div>
      </div>
    </div>
  );
};

export default PublishPage;
