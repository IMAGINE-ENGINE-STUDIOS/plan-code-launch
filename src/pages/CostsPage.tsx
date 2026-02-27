import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, DollarSign, Zap, TrendingUp, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface UsageLog {
  id: string;
  project_id: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost: number;
  created_at: string;
  project_name?: string;
}

const CostsPage = () => {
  const { user } = useAuth();
  const [realtimeLogs, setRealtimeLogs] = useState<UsageLog[]>([]);

  // Fetch projects for name mapping
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-map', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select('id, name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));

  // Fetch usage logs
  const { data: usageLogs = [], isLoading } = useQuery({
    queryKey: ['usage-logs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('usage_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as UsageLog[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    setRealtimeLogs(usageLogs);
  }, [usageLogs, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('usage-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'usage_logs' },
        (payload) => {
          setRealtimeLogs(prev => [payload.new as UsageLog, ...prev]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const allLogs = realtimeLogs.length > 0 ? realtimeLogs : usageLogs;

  const totalCost = allLogs.reduce((sum, l) => sum + Number(l.estimated_cost), 0);
  const totalTokens = allLogs.reduce((sum, l) => sum + l.total_tokens, 0);
  const totalCalls = allLogs.length;

  // Per-project breakdown
  const perProject = allLogs.reduce<Record<string, { calls: number; tokens: number; cost: number }>>((acc, l) => {
    if (!acc[l.project_id]) acc[l.project_id] = { calls: 0, tokens: 0, cost: 0 };
    acc[l.project_id].calls++;
    acc[l.project_id].tokens += l.total_tokens;
    acc[l.project_id].cost += Number(l.estimated_cost);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="font-display text-2xl font-bold">Usage & Costs</h1>
          <p className="text-sm text-muted-foreground">Realtime AI usage tracking across all projects</p>
        </div>

        {/* Summary cards */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Cost</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCost.toFixed(4)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Tokens</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTokens.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">API Calls</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalCalls}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Cost/Call</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${totalCalls > 0 ? (totalCost / totalCalls).toFixed(4) : '0.0000'}</div>
            </CardContent>
          </Card>
        </div>

        {/* Per-project breakdown */}
        {Object.keys(perProject).length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-lg">Cost by Project</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Calls</TableHead>
                    <TableHead className="text-right">Tokens</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(perProject)
                    .sort(([, a], [, b]) => b.cost - a.cost)
                    .map(([pid, stats]) => (
                      <TableRow key={pid}>
                        <TableCell className="font-medium">{projectMap[pid] || pid.slice(0, 8)}</TableCell>
                        <TableCell className="text-right">{stats.calls}</TableCell>
                        <TableCell className="text-right">{stats.tokens.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${stats.cost.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Recent Activity
              <Badge variant="secondary" className="animate-pulse">Live</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : allLogs.length === 0 ? (
              <p className="py-10 text-center text-muted-foreground">No usage data yet. Start chatting with a project to see costs here.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Prompt</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allLogs.slice(0, 50).map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell className="font-medium">{projectMap[log.project_id] || log.project_id.slice(0, 8)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.model.split('/').pop()}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{log.prompt_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{log.completion_tokens.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono">${Number(log.estimated_cost).toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CostsPage;
